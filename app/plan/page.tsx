import { getPool } from "@/lib/db/pool";
import { listTrips } from "@/lib/db/trips";
import { listPois } from "@/lib/db/pois";
import { listSearchAreas } from "@/lib/db/search-area";
import { listActivities } from "@/lib/db/activities";
import { listTransfers } from "@/lib/db/transfers";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { listParticipants } from "@/lib/db/participants";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { requireSession } from "@/lib/auth/current-session";
import { PlanView } from "./plan-view";

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab — nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function PlanPage() {
  // Der Planer setzt eine angemeldete Person voraus (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus einem festen Wert.
  const session = await requireSession();
  const accountId = session.participant.accountId;

  const pool = getPool();
  const [
    trips,
    pois,
    searchAreas,
    activities,
    transfers,
    optionSelections,
    participants,
    tripParticipants,
  ] = await Promise.all([
    listTrips(pool, accountId),
    listPois(pool, accountId),
    listSearchAreas(pool, accountId),
    listActivities(pool, accountId),
    listTransfers(pool, accountId),
    listActivityOptionSelections(pool, accountId),
    listParticipants(pool, accountId),
    listTripParticipants(pool, accountId),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PlanView
      trips={trips}
      pois={pois}
      searchAreas={searchAreas}
      activities={activities}
      transfers={transfers}
      optionSelections={optionSelections}
      participants={participants}
      tripParticipants={tripParticipants}
      selfParticipantId={session.participant.id}
      today={today}
    />
  );
}
