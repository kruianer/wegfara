import type { Poi, PoiStatusFilter, PoiTypeFilter } from "./types";

/**
 * Was der Filter der POI-Liste gerade zeigt (req-060). Er wirkt allein auf
 * die Liste: die Karte daneben hat ihre eigene Statusauswahl (req-013), und
 * die KI-Suche in der Anlegezeile darueber nimmt ihn nicht mit.
 */
export interface PoiFilter {
  typeFilter: PoiTypeFilter;
  statusFilter: PoiStatusFilter;
}

/** Die Vorwahl beim Oeffnen: gefiltert wird zunaechst nichts. */
export const LEERER_POI_FILTER: PoiFilter = {
  typeFilter: "alle",
  statusFilter: "alle",
};

/**
 * Die POIs, die unter diesem Filter in der Liste stehen — in der Reihenfolge,
 * in der sie hereinkommen. Sortiert wird danach (siehe sortierePois).
 */
export function gefiltertePois(pois: Poi[], filter: PoiFilter): Poi[] {
  return pois.filter(
    (poi) =>
      (filter.typeFilter === "alle" || poi.type === filter.typeFilter) &&
      (filter.statusFilter === "alle" || poi.status === filter.statusFilter),
  );
}
