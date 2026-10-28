import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { createOpenAiClient } from "@/lib/ai/openai-client";
import { AI_FEHLER_TEXT } from "@/lib/ai/fehler";
import { findTrip } from "@/lib/db/trips";
import { listActivities } from "@/lib/db/activities";
import { listPois } from "@/lib/db/pois";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import {
  setzeHandUeberschrift,
  speichereKiUeberschriften,
} from "@/lib/db/tages-ueberschriften";
import { druckTage } from "@/lib/druck/stationen";
import {
  schlageUeberschriftenVor,
  TAGES_UEBERSCHRIFT_MAX_LENGTH,
  UEBERSCHRIFTEN_FEHLGESCHLAGEN,
} from "@/lib/druck/ueberschriften";
import { selectionsForVisibleTrips } from "@/lib/trips/visible";

/**
 * Die Ueberschriften der Reisetage fuer Seite 2 des gedruckten Plans
 * (req-103).
 *
 * - POST `{ tripId }` laesst die KI sie vorschlagen und speichert sie. Eine
 *   von Hand geschriebene bleibt dabei stehen. Es kostet ueber den
 *   Zugangsschluessel des Accounts (req-028) und laeuft nur auf Knopfdruck --
 *   nie bei jedem Aufbau der Seite.
 * - PUT `{ tripId, datum, text }` setzt eine von Hand; ein leerer Text nimmt
 *   sie weg, dann stehen wieder die Orte des Tages da.
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024).
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)
    : null;
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  const tripId = textOf(body?.tripId);
  if (tripId.length === 0) return invalidBody();

  const db = getPool();
  const trip = await findTrip(db, session.accountId, tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  const apiKey = await accountApiKey(db, session.accountId, "ki_suche");
  if (!apiKey) {
    return Response.json(
      { error: apiKeyMissingHint("ki_suche") },
      { status: 409 },
    );
  }

  const [activities, pois, optionSelections] = await Promise.all([
    listActivities(db, session.accountId, tripId),
    listPois(db, session.accountId, tripId),
    listActivityOptionSelections(db, session.accountId),
  ]);
  const tage = druckTage({
    trip,
    activities,
    pois,
    optionSelections: selectionsForVisibleTrips(
      optionSelections,
      new Set([tripId]),
    ),
  });

  const antwort = await schlageUeberschriftenVor(
    createOpenAiClient({ apiKey }),
    tage,
  );
  if (!antwort.ok) {
    // Der Grund wird benannt (bug-021); der Plan bleibt, wie er war.
    return Response.json(
      {
        error: antwort.fehler
          ? AI_FEHLER_TEXT[antwort.fehler.art]
          : UEBERSCHRIFTEN_FEHLGESCHLAGEN,
      },
      { status: 502 },
    );
  }

  const ueberschriften = await speichereKiUeberschriften(
    db,
    session.accountId,
    tripId,
    antwort.ueberschriften,
    new Date(),
  );
  return Response.json({ ueberschriften });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  const tripId = textOf(body?.tripId);
  const datum = textOf(body?.datum);
  const text = textOf(body?.text);
  if (
    tripId.length === 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(datum) ||
    typeof body?.text !== "string" ||
    text.length > TAGES_UEBERSCHRIFT_MAX_LENGTH
  ) {
    return invalidBody();
  }

  const ueberschriften = await setzeHandUeberschrift(
    getPool(),
    session.accountId,
    tripId,
    datum,
    text,
    new Date(),
  );
  if (!ueberschriften) {
    return Response.json({ error: "unknown trip" }, { status: 404 });
  }
  return Response.json({ ueberschriften });
}
