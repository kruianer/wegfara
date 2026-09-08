import { getPool } from "@/lib/db/pool";
import { listTripsForSession } from "@/lib/db/trips";
import { listActivities } from "@/lib/db/activities";
import { listTransfers } from "@/lib/db/transfers";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { listParticipants } from "@/lib/db/participants";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { listExpenses } from "@/lib/db/expenses";
import { listDocuments } from "@/lib/db/documents";
import { listPois } from "@/lib/db/pois";
import { listRatingRounds, listRatingVotes } from "@/lib/db/rating-rounds";
import { listEnabledTripIds } from "@/lib/db/position-sharing";
import { requireTripAccess } from "@/lib/auth/current-session";
import { darfPlanen } from "@/lib/einstieg/ziel";
import { lokaleZeit } from "@/lib/live-status/zeit";
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
  const jetzt = new Date();
  const today = jetzt.toISOString().slice(0, 10);

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
    pois,
    runden,
    stimmen,
    geteilteReisen,
  ] = await Promise.all([
    listTripsForSession(pool, session),
    listActivities(pool, accountId),
    listTransfers(pool, accountId),
    listActivityOptionSelections(pool, accountId),
    listParticipants(pool, accountId),
    listTripParticipants(pool, accountId),
    listExpenses(pool, accountId),
    listDocuments(pool, accountId),
    // Die Bewertungsrunde (req-054): der Begleiter braucht die POIs, ueber
    // die abgestimmt wird -- gesammelt werden sie im Planer.
    listPois(pool, accountId),
    listRatingRounds(pool, accountId),
    listRatingVotes(pool, accountId),
    // Der Schalter "Meine Position teilen" (req-050) -- vorbelegt mit dem
    // zuletzt gewaehlten Zustand, damit die Freigabe wirklich bis zum
    // Widerruf gilt und nicht bei jedem Aufruf neu gesetzt werden muss.
    listEnabledTripIds(pool, accountId, session.participant.id),
  ]);

  const sichtbar = visibleTripIds(trips);
  const sichtbareRunden = forVisibleTrips(runden, sichtbar);
  const sichtbareRundenIds = new Set(sichtbareRunden.map((runde) => runde.id));
  // Nur die POIs, ueber die abgestimmt wird oder wurde -- die uebrige
  // POI-Sammlung geht den Begleiter nichts an.
  const rundenPoiIds = new Set(
    sichtbareRunden.flatMap((runde) => runde.poiIds),
  );

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
      pois={forVisibleTrips(pois, sichtbar).filter((poi) =>
        rundenPoiIds.has(poi.id),
      )}
      runden={sichtbareRunden}
      stimmen={stimmen.filter((stimme) =>
        sichtbareRundenIds.has(stimme.roundId),
      )}
      selfParticipantId={session.participant.id}
      // Wer beide Bereiche darf, findet im Kopfbereich beider einen Wechsel
      // (req-055) -- wer nur den Begleiter darf, sieht ihn gar nicht erst.
      darfPlanen={darfPlanen({
        tripParticipants,
        participantId: session.participant.id,
        accountAdmin: session.accountAdmin,
      })}
      geteilteReisen={geteilteReisen}
      today={today}
      // Die Uhrzeit des Live-Status (req-051) beginnt beim Aufbau der Seite
      // und laeuft danach im Geraet weiter.
      jetzt={lokaleZeit(jetzt)}
    />
  );
}
