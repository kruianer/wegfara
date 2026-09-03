import { getPool } from "@/lib/db/pool";
import { listTripsForParticipant } from "@/lib/db/trips";
import { listActivities } from "@/lib/db/activities";
import { listTransfers } from "@/lib/db/transfers";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
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
  const accountId = session.participant.accountId;

  const pool = getPool();
  const [trips, activities, transfers, optionSelections] = await Promise.all([
    listTripsForParticipant(pool, accountId, session.participant.id),
    listActivities(pool, accountId),
    listTransfers(pool, accountId),
    listActivityOptionSelections(pool, accountId),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  const sichtbar = visibleTripIds(trips);

  return (
    <GoView
      trips={trips}
      activities={forVisibleTrips(activities, sichtbar)}
      transfers={forVisibleTrips(transfers, sichtbar)}
      optionSelections={selectionsForVisibleTrips(optionSelections, sichtbar)}
      today={today}
    />
  );
}
