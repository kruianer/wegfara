import { getPool } from "@/lib/db/pool";
import { listTrips } from "@/lib/db/trips";
import { ACCOUNT_ID } from "@/lib/account";
import { GoView } from "./go-view";

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab — nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function GoPage() {
  const trips = await listTrips(getPool(), ACCOUNT_ID);
  const today = new Date().toISOString().slice(0, 10);

  return <GoView trips={trips} today={today} />;
}
