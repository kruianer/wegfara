import type { Activity } from "@/lib/activities/types";
import type { Poi, PoiStatus } from "./types";

const PLANNABLE_STATUSES: PoiStatus[] = ["gesetzt", "wahrscheinlich"];

/**
 * Ob ein POI ueberhaupt verplant werden darf (req-039, Out of Scope): nur
 * "Gesetzt" und "Wahrscheinlich" -- dieselben, die in der POI-Auswahl der
 * Planung stehen. Verplant und bewertet bleiben getrennt: das Verplanen
 * aendert den Status nicht.
 */
export function isPlannablePoi(poi: Pick<Poi, "status">): boolean {
  return PLANNABLE_STATUSES.includes(poi.status);
}

/**
 * POIs einer Reise, die sich ueberhaupt verplanen lassen (siehe req-011,
 * req-083). Bis req-083 hiess diese Liste "Noch unverplant" und schloss
 * bereits verplante POIs aus; seit req-083 laesst sich ein POI beliebig oft
 * verplanen, die Auswahl zeigt deshalb alle, unabhaengig davon, ob und wie
 * oft sie schon einen Programmpunkt haben.
 */
export function plannablePois(pois: Poi[]): Poi[] {
  return pois.filter(isPlannablePoi);
}

/**
 * Wie oft jeder POI ueber die ganze Reise verplant ist (req-083): gezaehlt
 * werden alle Programmpunkte, die per `poiId` auf ihn verweisen -- nicht nur
 * die des gewaehlten Reisetages. Ein POI ohne Eintrag ist noch nicht
 * verplant; das ist bewusst von der Zahl 0 zu unterscheiden (Akzeptanzkriterien).
 */
export function poiPlanCounts(activities: Activity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const activity of activities) {
    if (!activity.poiId) continue;
    counts.set(activity.poiId, (counts.get(activity.poiId) ?? 0) + 1);
  }
  return counts;
}
