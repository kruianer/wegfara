import { getPool } from "@/lib/db/pool";
import { createActivity, deleteActivity } from "@/lib/db/activities";
import { findPoi } from "@/lib/db/pois";
import { findTrip } from "@/lib/db/trips";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { plannedActivityFromPoi } from "@/lib/plan/plan-poi";

/**
 * Einen POI verplanen und seinen Programmpunkt wieder entfernen (req-039).
 * Beides sind Vorgaenge, bei denen der Nutzer eine Bestaetigung erwartet --
 * sie werden sofort geschrieben, nicht verzoegert (siehe delivery/stack.md,
 * Conventions).
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024): POIs
 * und Programmpunkte anderer Accounts existieren fuer diese Sitzung nicht.
 * Was daraus entsteht, rechnet die Domaenenlogik aus -- die Anfrage sagt nur,
 * welcher POI wo losgelassen wurde.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
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
  if (!body) return invalidBody();

  const poiId = textOf(body.poiId).trim();
  const startAt = textOf(body.startAt).trim();
  if (poiId.length === 0 || startAt.length === 0) return invalidBody();

  const poi = await findPoi(getPool(), session.accountId, poiId);
  if (!poi) return Response.json({ error: "unknown poi" }, { status: 404 });

  const trip = await findTrip(getPool(), session.accountId, poi.tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  // Einrasten, Dauer, Typ und Zeitraum der Reise stecken in dieser einen
  // Funktion -- die Oberflaeche rechnet mit derselben (req-039).
  const values = plannedActivityFromPoi(poi, trip, startAt);
  if (!values) return invalidBody();

  const activity = await createActivity(getPool(), session.accountId, values);
  if (!activity)
    return Response.json({ error: "unknown trip" }, { status: 404 });

  return Response.json({ activity }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id).trim();
  if (id.length === 0) return invalidBody();

  const activity = await deleteActivity(getPool(), session.accountId, id);
  if (!activity)
    return Response.json({ error: "unknown activity" }, { status: 404 });

  // Der entfernte Programmpunkt kommt zurueck: stammt er aus einem POI,
  // steht dieser danach wieder unter "Noch unverplant" (req-039).
  return Response.json({ activity });
}
