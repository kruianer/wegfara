import { getPool } from "@/lib/db/pool";
import { listTrips } from "@/lib/db/trips";
import { listPois } from "@/lib/db/pois";
import { listActivities } from "@/lib/db/activities";
import { listTransfers } from "@/lib/db/transfers";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { ACCOUNT_ID } from "@/lib/account";
import { PlanView } from "./plan-view";

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab — nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const pool = getPool();
  const [trips, pois, activities, transfers, optionSelections] =
    await Promise.all([
      listTrips(pool, ACCOUNT_ID),
      listPois(pool, ACCOUNT_ID),
      listActivities(pool, ACCOUNT_ID),
      listTransfers(pool, ACCOUNT_ID),
      listActivityOptionSelections(pool, ACCOUNT_ID),
    ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PlanView
      trips={trips}
      pois={pois}
      activities={activities}
      transfers={transfers}
      optionSelections={optionSelections}
      today={today}
    />
  );
}
