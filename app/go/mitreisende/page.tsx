import { redirect } from "next/navigation";
import { getPool } from "@/lib/db/pool";
import { listTripsForSession } from "@/lib/db/trips";
import { listParticipants } from "@/lib/db/participants";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { requireTripAccess } from "@/lib/auth/current-session";
import { BEGLEITER_PATH } from "@/lib/einstieg/ziel";
import {
  darfMitreisendeVerwalten,
  tripAssignments,
} from "@/lib/trip-participants/rules";
import { MitreisendeView } from "./mitreisende-view";

// Haengt von Live-Daten aus der DB ab -- nie statisch vorrendern.
export const dynamic = "force-dynamic";

/**
 * "Wer faehrt mit" im Begleiter (req-087): die Mitreisenden der Reise, die im
 * Begleiter gerade offen ist. Welche das ist, sagt `?reise=` -- eine eigene
 * Reise-Auswahl gibt es hier nicht.
 *
 * Wer die Mitreisenden dieser Reise nicht bearbeiten darf, oder wer die Reise
 * gar nicht sieht, landet ohne Meldung im Begleiter: der Eintrag unter "Mehr"
 * stand fuer ihn ohnehin nicht da.
 */
export default async function MitreisendePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reise } = await searchParams;
  const session = await requireTripAccess();
  const accountId = session.accountId;

  const pool = getPool();
  const [trips, participants, tripParticipants] = await Promise.all([
    listTripsForSession(pool, session),
    listParticipants(pool, accountId),
    listTripParticipants(pool, accountId),
  ]);

  const trip = trips.find((candidate) => candidate.id === reise);
  if (
    !trip ||
    !darfMitreisendeVerwalten({
      tripParticipants,
      tripId: trip.id,
      participantId: session.participant.id,
      accountAdmin: session.accountAdmin,
    })
  ) {
    redirect(BEGLEITER_PATH);
  }

  return (
    <MitreisendeView
      trip={trip}
      // Name und Zugang genuegen hier -- Adresse, Telefonnummer und
      // Bankverbindung gehen den Begleiter nichts an (siehe
      // delivery/security.md). Angelegt und bearbeitet werden Personen in
      // "Mein Bereich" (req-087, Out of Scope).
      participants={participants.map(
        ({ id, name, nickname, loginEnabled }) => ({
          id,
          name,
          nickname,
          loginEnabled,
        }),
      )}
      tripParticipants={tripAssignments(tripParticipants, trip.id)}
    />
  );
}
