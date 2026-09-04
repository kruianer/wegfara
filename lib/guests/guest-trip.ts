import type { Queryable } from "../db/queryable";
import { listTrips } from "../db/trips";
import { listPois } from "../db/pois";
import { listActivities } from "../db/activities";
import { listTransfers } from "../db/transfers";
import { listActivityOptionSelections } from "../db/activity-option-selections";
import { selectionsForVisibleTrips } from "../trips/visible";
import type { Trip } from "../trips/types";
import type { Poi } from "../pois/types";
import type { Activity } from "../activities/types";
import type { Transfer } from "../transfers/types";
import type { GuestSession } from "./types";

/**
 * Was ein Gast zu sehen bekommt (req-038): der Plan, die Programmpunkte und
 * die POIs **genau einer** Reise -- der, die in seinem Gastzugang steht.
 *
 * Nicht dabei sind Ausgaben, Salden, Ausgleich, Belege und Dokumente,
 * Bankverbindungen, Teilnehmerdaten und Positionen der Gruppe. Sie werden
 * hier gar nicht erst geladen: was nicht geladen wird, kann auch nicht
 * versehentlich ausgeliefert werden.
 *
 * Gefiltert wird zweifach -- nach dem Account des Gastzugangs und nach
 * seiner Reise.
 */
export interface GuestTripData {
  trip: Trip;
  pois: Poi[];
  activities: Activity[];
  transfers: Transfer[];
  optionSelections: Record<string, string>;
}

export async function loadGuestTrip(
  db: Queryable,
  guest: GuestSession,
): Promise<GuestTripData | null> {
  const { accountId, tripId } = guest;

  const trips = await listTrips(db, accountId);
  const trip = trips.find((vorhanden) => vorhanden.id === tripId);
  if (!trip) return null;

  const [pois, activities, transfers, optionSelections] = await Promise.all([
    listPois(db, accountId),
    listActivities(db, accountId),
    listTransfers(db, accountId),
    listActivityOptionSelections(db, accountId),
  ]);

  return {
    trip,
    pois: pois.filter((poi) => poi.tripId === tripId),
    activities: activities.filter((activity) => activity.tripId === tripId),
    transfers: transfers.filter((transfer) => transfer.tripId === tripId),
    optionSelections: selectionsForVisibleTrips(
      optionSelections,
      new Set([tripId]),
    ),
  };
}
