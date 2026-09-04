import { getPool } from "@/lib/db/pool";
import {
  createTrip,
  deleteTrip,
  setTripState,
  updateTrip,
} from "@/lib/db/trips";
import { assignTripParticipant } from "@/lib/db/trip-participants";
import { listPhotoFileNamesOfTrip } from "@/lib/db/poi-photos";
import { findFirstPersonOfAccount } from "@/lib/db/accounts";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import { isTripState } from "@/lib/trips/state";
import type { MainPlace } from "@/lib/trips/types";
import {
  tripDraftIsValid,
  validateTripDraft,
  type TripDraft,
} from "@/lib/trips/validate";

/**
 * Reisen anlegen, aendern und loeschen (siehe req-017). Die Pruefung der
 * Eingaben liegt in lib/trips/validate.ts und ist damit dieselbe wie im
 * Formular -- ein Aufruf an dieser Schnittstelle vorbei kann keine
 * unzulaessige Reise anlegen.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Raeumt die Bilddateien der geloeschten POIs aus der Ablage (req-026:
 * beim Entfernen eines POI werden seine Fotos mitentfernt). Ohne
 * eingerichtetes Bildverzeichnis gibt es nichts zu raeumen.
 */
async function entferneBilddateien(fileNames: string[]): Promise<void> {
  if (fileNames.length === 0) return;
  try {
    const store = fileSystemPhotoStore();
    for (const fileName of fileNames) {
      await store.remove(fileName).catch(() => {});
    }
  } catch {
    return;
  }
}

function parseMainPlace(value: unknown): MainPlace | null {
  if (typeof value !== "object" || value === null) return null;
  const place = value as Record<string, unknown>;
  const name = textOf(place.name);
  const { lat, lng } = place;
  if (
    name.length === 0 ||
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lng !== "number" ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { name, lat, lng };
}

function parseTripDraft(body: Record<string, unknown>): TripDraft {
  return {
    title: textOf(body.title),
    startDate: textOf(body.startDate),
    endDate: textOf(body.endDate),
    mainPlace: parseMainPlace(body.mainPlace),
    // Freiwillig (req-033): fehlt sie in der Anfrage, ist sie leer -- das
    // ist kein Fehler, sondern der Normalfall einer Reise ohne Beschreibung.
    description: textOf(body.description),
  };
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const draft = parseTripDraft(body);
  if (!tripDraftIsValid(draft)) {
    return Response.json({ errors: validateTripDraft(draft) }, { status: 400 });
  }

  const accountId = session.accountId;
  const trip = await createTrip(getPool(), accountId, draft);

  // Wer eine Reise anlegt, ist ihr automatisch als Reiseleiter zugeordnet
  // (req-021) -- so hat jede Reise von Anfang an mindestens einen.
  //
  // Arbeitet der Gesamt-Admin gerade in einem fremden Account, gehoert er
  // dort zu niemandem: dann fuehrt die erste Person dieses Accounts die
  // Reise (req-025). Sonst stuende sie ohne Reiseleiter da.
  const leader = session.actingAccount
    ? await findFirstPersonOfAccount(getPool(), accountId)
    : { id: session.participant.id };
  const assigned = leader
    ? await assignTripParticipant(
        getPool(),
        accountId,
        trip.id,
        leader.id,
        "reiseleiter",
      )
    : ({ ok: false } as const);
  return Response.json(
    { trip, tripParticipant: assigned.ok ? assigned.tripParticipant : null },
    { status: 201 },
  );
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  const id = body ? textOf(body.id) : "";
  if (!body || id.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const draft = parseTripDraft(body);
  if (!tripDraftIsValid(draft)) {
    return Response.json({ errors: validateTripDraft(draft) }, { status: 400 });
  }

  const trip = await updateTrip(getPool(), session.accountId, id, draft);
  // Eine Reise eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  return Response.json({ trip });
}

/**
 * Setzt den Zustand einer Reise (req-022). Getrennt von PUT, das die
 * Eckdaten aendert: der Zustand wechselt sofort beim Umstellen und darf das
 * ohne die uebrigen Eingaben -- auch wenn beides seit req-033 in derselben
 * Karte steht.
 */
export async function PATCH(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  const id = body ? textOf(body.id) : "";
  if (!body || id.length === 0 || !isTripState(body.state)) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const trip = await setTripState(getPool(), session.accountId, id, body.state);
  // Eine Reise eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  return Response.json({ trip });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  const id = body ? textOf(body.id) : "";
  if (!body || id.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();
  // Die Namen der Bilddateien noch vor dem Loeschen holen -- danach ist der
  // Datensatz weg und die Datei waere verwaist (req-026, Constraints).
  const fileNames = await listPhotoFileNamesOfTrip(db, id);

  const deleted = await deleteTrip(db, session.accountId, id);
  if (!deleted)
    return Response.json({ error: "unknown trip" }, { status: 404 });

  await entferneBilddateien(fileNames);

  return Response.json({ status: "ok" });
}
