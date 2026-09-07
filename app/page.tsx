import { redirect } from "next/navigation";
import { getPool } from "@/lib/db/pool";
import { requireSession } from "@/lib/auth/current-session";
import { listTripsForSession } from "@/lib/db/trips";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { listRatingRounds } from "@/lib/db/rating-rounds";
import { einstiegsZiel } from "@/lib/einstieg/ziel";

// Haengt vom aktuellen Datum, von der Sitzung und von Live-Daten aus der DB
// ab — nie statisch vorrendern.
export const dynamic = "force-dynamic";

/**
 * Die Hauptadresse leitet weiter, statt eine Auswahl zu zeigen (req-055).
 * Die Startseite mit den drei Kacheln aus req-015 gibt es nicht mehr: wo
 * jemand hingehoert, weiss die App besser als er.
 *
 * Wer nicht angemeldet ist, kommt zur Anmeldung -- darum kuemmert sich
 * bereits die middleware, requireSession() ist die belastbare Pruefung
 * dahinter.
 */
export default async function Home() {
  const session = await requireSession();
  const accountId = session.accountId;

  const pool = getPool();
  const [trips, tripParticipants, runden] = await Promise.all([
    listTripsForSession(pool, session),
    listTripParticipants(pool, accountId),
    listRatingRounds(pool, accountId),
  ]);

  redirect(
    einstiegsZiel({
      trips,
      runden,
      tripParticipants,
      participantId: session.participant.id,
      accountAdmin: session.accountAdmin,
      today: new Date().toISOString().slice(0, 10),
    }),
  );
}
