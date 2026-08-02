import type { Activity } from "@/lib/activities/types";
import type { Poi, PoiStatus } from "./types";

const PLANNABLE_STATUSES: PoiStatus[] = ["gesetzt", "wahrscheinlich"];

/**
 * POIs einer Reise, die noch mit keinem Programmpunkt verknuepft sind
 * (siehe req-011). Nur die Status "Gesetzt" und "Wahrscheinlich" gehoeren
 * ueberhaupt in die Spalte "Noch unverplant" (Funktion); ein POI gilt als
 * verplant, sobald irgendein Programmpunkt per `poiId` auf ihn verweist.
 */
export function unplannedPois(pois: Poi[], activities: Activity[]): Poi[] {
  const plannedPoiIds = new Set(
    activities.map((a) => a.poiId).filter((id): id is string => Boolean(id)),
  );
  return pois.filter(
    (poi) =>
      PLANNABLE_STATUSES.includes(poi.status) && !plannedPoiIds.has(poi.id),
  );
}
