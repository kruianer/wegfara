import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { getPool } from "@/lib/db/pool";
import { listTripsForSession } from "@/lib/db/trips";
import { listParticipants } from "@/lib/db/participants";
import { isPositionSharingEnabled } from "@/lib/db/position-sharing";
import { listTripPositions, saveTripPosition } from "@/lib/db/trip-positions";
import { participantDisplayName } from "@/lib/participants/display-name";
import { sichtbarePositionen } from "@/lib/positions/sichtbar";
import { zeigtLiveStatus } from "@/lib/live-status/sichtbar";
import { toIsoDate } from "@/lib/trips/date-utils";

/**
 * Die geteilten Positionen einer Reise fuer die Karte im Begleiter
 * (req-050). Anders als /api/live-status, das nur Ort und Verzug
 * herausgibt, stehen hier alle noch frischen Positionen mit Namen -- die
 * Karte zeigt je Teilnehmer, der teilt, einen eigenen Punkt.
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const tripId = new URL(request.url).searchParams.get("reise")?.trim() ?? "";
  if (tripId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const pool = getPool();
  const trips = await listTripsForSession(pool, session);
  const trip = trips.find((eintrag) => eintrag.id === tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  // Ausserhalb des Zeitraums oder vor der Freigabe gibt es keine
  // Positionen zu sehen -- ebenso wie beim Live-Status (req-051).
  if (!zeigtLiveStatus(trip, toIsoDate(new Date()))) {
    return Response.json({ positionen: [] });
  }

  const [positionen, participants] = await Promise.all([
    listTripPositions(pool, session.accountId, tripId),
    listParticipants(pool, session.accountId),
  ]);

  const namen = new Map(
    participants.map((person) => [person.id, participantDisplayName(person)]),
  );

  const benannt = sichtbarePositionen(positionen, new Date())
    .filter((position) => namen.has(position.participantId))
    .map((position) => ({
      ...position,
      name: namen.get(position.participantId)!,
    }));

  return Response.json({ positionen: benannt });
}

/**
 * Speichert die eigene Position (req-050). Geteilt wird nur, wenn beides
 * zutrifft: die Person hat "Meine Position teilen" eingeschaltet, und die
 * Reise ist gerade freigegeben und im Zeitraum -- sonst passiert nichts,
 * auch nicht bei eingeschaltetem Schalter.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    tripId?: unknown;
    lat?: unknown;
    lng?: unknown;
  } | null;
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  const { lat, lng } = body ?? {};

  if (
    tripId.length === 0 ||
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const pool = getPool();
  const trips = await listTripsForSession(pool, session);
  const trip = trips.find((eintrag) => eintrag.id === tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  const jetzt = new Date();
  const berechtigt =
    zeigtLiveStatus(trip, toIsoDate(jetzt)) &&
    (await isPositionSharingEnabled(
      pool,
      session.accountId,
      tripId,
      session.participant.id,
    ));
  if (!berechtigt) return Response.json({ gespeichert: false });

  await saveTripPosition(
    pool,
    session.accountId,
    tripId,
    session.participant.id,
    { lat, lng },
    jetzt,
  );

  return Response.json({ gespeichert: true });
}
