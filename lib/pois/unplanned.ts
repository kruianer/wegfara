import type { Activity } from "@/lib/activities/types";
import type { Poi, PoiStatus } from "./types";

const PLANNABLE_STATUSES: PoiStatus[] = ["gesetzt", "wahrscheinlich"];

/**
 * Ob ein POI ueberhaupt verplant werden darf (req-039, Out of Scope): nur
 * "Gesetzt" und "Wahrscheinlich" -- dieselben, die in "Noch unverplant"
 * stehen. Verplant und bewertet bleiben getrennt: das Verplanen aendert den
 * Status nicht.
 */
export function isPlannablePoi(poi: Pick<Poi, "status">): boolean {
  return PLANNABLE_STATUSES.includes(poi.status);
}

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
    (poi) => isPlannablePoi(poi) && !plannedPoiIds.has(poi.id),
  );
}
