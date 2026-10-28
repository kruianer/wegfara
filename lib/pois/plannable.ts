import type { Activity } from "@/lib/activities/types";
import type { Poi, PoiPlanFilter, PoiStatus, PoiVerplanung } from "./types";

/** Die Status, die sich verplanen lassen -- nur sie stehen in der POI-Auswahl. */
export const PLANNABLE_STATUSES: PoiStatus[] = ["gesetzt", "wahrscheinlich"];

/**
 * Ob ein POI ueberhaupt verplant werden darf (req-039, Out of Scope): nur
 * "Fix" und "Alternative" -- dieselben, die in der POI-Auswahl der
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

/** Ob ein POI noch unverplant ist oder schon einen Programmpunkt hat. */
export function poiVerplanung(
  poi: Pick<Poi, "id">,
  counts: Map<string, number>,
): PoiVerplanung {
  return (counts.get(poi.id) ?? 0) > 0 ? "verplant" : "unverplant";
}

/**
 * Ob ein POI zum Filter nach Verplanungsstand passt (req-083, req-099): die
 * leere Menge laesst jeden durch, sonst muss sein Stand darin stehen.
 * Angewandt wird er in der einen Filterlogik (listenansicht.ts,
 * gefiltertePois).
 */
export function entsprichtPlanFilter(
  poi: Pick<Poi, "id">,
  counts: Map<string, number>,
  filter: PoiPlanFilter,
): boolean {
  return filter.length === 0 || filter.includes(poiVerplanung(poi, counts));
}
