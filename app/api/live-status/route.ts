import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { getPool } from "@/lib/db/pool";
import { listActivities } from "@/lib/db/activities";
import { listTripsForSession } from "@/lib/db/trips";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { listTripPositions } from "@/lib/db/trip-positions";
import { ermittleStandortlage } from "@/lib/live-status/standortlage";
import { zeigtLiveStatus } from "@/lib/live-status/sichtbar";
import { OHNE_STANDORT } from "@/lib/live-status/types";
import { nominatimOrtLookup } from "@/lib/osm/ort-lookup";
import { createOsrmClient } from "@/lib/routing/osrm-client";
import { toIsoDate } from "@/lib/trips/date-utils";

/**
 * Ort und Verzug des Live-Status (req-051). Beides laeuft ueber den Server:
 * die Positionen der Gruppe gehen den Browser nur so weit an, wie der
 * Status sie zeigt, und der Routing-Dienst kann spaeter auf dem Beelink
 * liegen, wo ihn kein Smartphone von aussen erreicht.
 *
 * Der Programmpunkt "Laut Plan" steht dagegen schon im Begleiter -- er wird
 * dort aus denselben Daten gerechnet und nicht noch einmal abgefragt.
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const tripId = new URL(request.url).searchParams.get("reise")?.trim() ?? "";
  if (tripId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const pool = getPool();
  // Nur eine Reise, die diese Person ueberhaupt sieht (req-023) -- der
  // Mandant kommt dabei aus der Anmeldung, nie aus der Anfrage (req-024).
  const trips = await listTripsForSession(pool, session);
  const trip = trips.find((eintrag) => eintrag.id === tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  const jetzt = new Date();
  // Ausserhalb des Zeitraums oder vor der Freigabe gibt es keinen
  // Live-Status -- und damit auch von hier keine Positionen.
  if (!zeigtLiveStatus(trip, toIsoDate(jetzt))) {
    return Response.json(OHNE_STANDORT);
  }

  const [activities, zuordnungen, positionen] = await Promise.all([
    listActivities(pool, session.accountId),
    listTripParticipants(pool, session.accountId),
    listTripPositions(pool, session.accountId, trip.id),
  ]);

  const lage = await ermittleStandortlage(
    {
      tripId: trip.id,
      selbstId: session.participant.id,
      zuordnungen,
      positionen,
      activities,
      jetzt,
    },
    { routing: createOsrmClient(), ortLookup: nominatimOrtLookup },
  );

  return Response.json(lage);
}
