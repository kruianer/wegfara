import { getPool } from "@/lib/db/pool";
import { listTrips } from "@/lib/db/trips";
import { listActivities } from "@/lib/db/activities";
import { listTransfers } from "@/lib/db/transfers";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { requireSession } from "@/lib/auth/current-session";
import { GoView } from "./go-view";

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab — nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function GoPage() {
  // Der Begleiter setzt eine angemeldete Person voraus (req-016); der
  // Mandant ergibt sich aus ihrem Konto, nie aus einem festen Wert.
  const session = await requireSession();
  const accountId = session.participant.accountId;

  const pool = getPool();
  const [trips, activities, transfers, optionSelections] = await Promise.all([
    listTrips(pool, accountId),
    listActivities(pool, accountId),
    listTransfers(pool, accountId),
    listActivityOptionSelections(pool, accountId),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <GoView
      trips={trips}
      activities={activities}
      transfers={transfers}
      optionSelections={optionSelections}
      today={today}
    />
  );
}
