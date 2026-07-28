import { getPool } from "@/lib/db/pool";
import { listTrips } from "@/lib/db/trips";
import { listActivities } from "@/lib/db/activities";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { ACCOUNT_ID } from "@/lib/account";
import { GoView } from "./go-view";

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab — nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function GoPage() {
  const pool = getPool();
  const [trips, activities, optionSelections] = await Promise.all([
    listTrips(pool, ACCOUNT_ID),
    listActivities(pool, ACCOUNT_ID),
    listActivityOptionSelections(pool, ACCOUNT_ID),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <GoView
      trips={trips}
      activities={activities}
      optionSelections={optionSelections}
      today={today}
    />
  );
}
