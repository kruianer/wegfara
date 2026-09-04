import { getPool } from "@/lib/db/pool";
import { listTripsForSession } from "@/lib/db/trips";
import { listActivities } from "@/lib/db/activities";
import { listTransfers } from "@/lib/db/transfers";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { listParticipants } from "@/lib/db/participants";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { listExpenses } from "@/lib/db/expenses";
import { listDocuments } from "@/lib/db/documents";
import { requireTripAccess } from "@/lib/auth/current-session";
import {
  forVisibleTrips,
  selectionsForVisibleTrips,
  visibleTripIds,
} from "@/lib/trips/visible";
import { GoView } from "./go-view";

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab — nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function GoPage() {
  // Der Begleiter setzt eine angemeldete Person voraus (req-016); der
  // Mandant ergibt sich aus ihrem Konto, nie aus einem festen Wert. Ist die
  // Person keiner freigegebenen Reise mehr zugeordnet, endet ihre Sitzung
  // hier (req-023).
  const session = await requireTripAccess();
  // Der Account, in dem gerade gearbeitet wird -- der eigene oder der
  // fremde, in den der Gesamt-Admin gewechselt hat (req-025). Immer genau
  // einer.
  const accountId = session.accountId;

  const pool = getPool();
  const [
    trips,
    activities,
    transfers,
    optionSelections,
    participants,
    tripParticipants,
    expenses,
    documents,
  ] = await Promise.all([
    listTripsForSession(pool, session),
    listActivities(pool, accountId),
    listTransfers(pool, accountId),
    listActivityOptionSelections(pool, accountId),
    listParticipants(pool, accountId),
    listTripParticipants(pool, accountId),
    listExpenses(pool, accountId),
    listDocuments(pool, accountId),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  const sichtbar = visibleTripIds(trips);

  return (
    <GoView
      trips={trips}
      activities={forVisibleTrips(activities, sichtbar)}
      transfers={forVisibleTrips(transfers, sichtbar)}
      optionSelections={selectionsForVisibleTrips(optionSelections, sichtbar)}
      // Nur der Name geht an den Begleiter: Telefonnummer und
      // Bankverbindung gehen ihn nichts an (siehe delivery/security.md).
      participants={participants.map(({ id, name, nickname }) => ({
        id,
        name,
        nickname,
      }))}
      tripParticipants={forVisibleTrips(tripParticipants, sichtbar)}
      expenses={forVisibleTrips(expenses, sichtbar)}
      documents={forVisibleTrips(documents, sichtbar)}
      selfParticipantId={session.participant.id}
      today={today}
    />
  );
}
