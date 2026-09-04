import { getPool } from "@/lib/db/pool";
import { listTripsForSession } from "@/lib/db/trips";
import { listPois } from "@/lib/db/pois";
import { listSearchAreas } from "@/lib/db/search-area";
import { listActivities } from "@/lib/db/activities";
import { listTransfers } from "@/lib/db/transfers";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { listParticipants } from "@/lib/db/participants";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { listDocuments } from "@/lib/db/documents";
import { accountApiKeyStates } from "@/lib/api-keys/account-keys";
import { requireTripAccess } from "@/lib/auth/current-session";
import {
  forVisibleTrips,
  selectionsForVisibleTrips,
  visibleTripIds,
} from "@/lib/trips/visible";
import { PlanView } from "./plan-view";

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab — nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function PlanPage() {
  // Der Planer setzt eine angemeldete Person voraus (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus einem festen Wert. Ist die Person
  // keiner freigegebenen Reise mehr zugeordnet, endet ihre Sitzung hier
  // (req-023).
  const session = await requireTripAccess();
  // Der Account, in dem gerade gearbeitet wird -- der eigene oder der
  // fremde, in den der Gesamt-Admin gewechselt hat (req-025). Immer genau
  // einer.
  const accountId = session.accountId;

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
    documents,
    apiKeys,
  ] = await Promise.all([
    listTripsForSession(pool, session),
    listPois(pool, accountId),
    listSearchAreas(pool, accountId),
    listActivities(pool, accountId),
    listTransfers(pool, accountId),
    listActivityOptionSelections(pool, accountId),
    listParticipants(pool, accountId),
    listTripParticipants(pool, accountId),
    listDocuments(pool, accountId),
    // Nur der Zustand der Zugangsschluessel, nie die Schluessel selbst
    // (req-028): er sperrt oder entsperrt die KI-Suche und den Import aus
    // Google.
    accountApiKeyStates(pool, accountId),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const sichtbar = visibleTripIds(trips);

  return (
    <PlanView
      trips={trips}
      pois={forVisibleTrips(pois, sichtbar)}
      searchAreas={forVisibleTrips(searchAreas, sichtbar)}
      activities={forVisibleTrips(activities, sichtbar)}
      transfers={forVisibleTrips(transfers, sichtbar)}
      optionSelections={selectionsForVisibleTrips(optionSelections, sichtbar)}
      participants={participants}
      tripParticipants={forVisibleTrips(tripParticipants, sichtbar)}
      documents={forVisibleTrips(documents, sichtbar)}
      selfParticipantId={session.participant.id}
      superAdmin={session.superAdmin}
      accountAdmin={session.accountAdmin}
      apiKeys={apiKeys}
      today={today}
    />
  );
}
