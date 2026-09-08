import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { getPool } from "@/lib/db/pool";
import { listTripsForSession } from "@/lib/db/trips";
import { setPositionSharing } from "@/lib/db/position-sharing";

/**
 * Schaltet "Meine Position teilen" fuer eine Reise ein oder aus (req-050).
 * Die Freigabe gilt bis zum Widerruf -- unabhaengig davon, ob gerade
 * tatsaechlich etwas geteilt werden darf (siehe lib/live-status/sichtbar.ts).
 * Das Senden der Position selbst laeuft ueber /api/positionen.
 */
export async function PATCH(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    tripId?: unknown;
    geteilt?: unknown;
  } | null;
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  const geteilt = body?.geteilt;

  if (tripId.length === 0 || typeof geteilt !== "boolean") {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  // Nur eine Reise, die diese Person ueberhaupt sieht (req-023) -- der
  // Mandant kommt dabei aus der Anmeldung, nie aus der Anfrage (req-024).
  const trips = await listTripsForSession(getPool(), session);
  if (!trips.some((trip) => trip.id === tripId)) {
    return Response.json({ error: "unknown trip" }, { status: 404 });
  }

  const ok = await setPositionSharing(
    getPool(),
    session.accountId,
    tripId,
    session.participant.id,
    geteilt,
    new Date(),
  );
  if (!ok) return Response.json({ error: "unknown trip" }, { status: 404 });

  return Response.json({ geteilt });
}
