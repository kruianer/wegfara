import { POI_STATUSES } from "./status-meta";
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

/** Wonach sich die POI-Liste ordnen laesst (req-060). */
export type PoiSortierung = "nummer" | "name" | "status" | "bewertung";

/** Die Reihenfolge, in der die Sortierungen zur Wahl stehen. */
export const POI_SORTIERUNGEN: PoiSortierung[] = [
  "nummer",
  "name",
  "status",
  "bewertung",
];

/**
 * Die Vorwahl: nach Nummer. Sie ist die Ordnung, in der die POIs entstanden
 * sind, und die Nummer bleibt fest -- ueber sie wird in der Gruppe und auf
 * der Karte gesprochen (req-013).
 */
export const VORGEWAEHLTE_SORTIERUNG: PoiSortierung = "nummer";

export const POI_SORTIERUNG_LABEL: Record<PoiSortierung, string> = {
  nummer: "Nummer",
  name: "Name",
  status: "Status",
  bewertung: "Bewertung",
};

/** Wie weit vorn ein Status steht: Gesetzt zuerst, Auf keinen Fall zuletzt. */
function statusRang(poi: Poi): number {
  return POI_STATUSES.indexOf(poi.status);
}

/**
 * Die POIs in der gewaehlten Reihenfolge (req-060) -- als neue Liste; die
 * hereingereichte bleibt unberuehrt.
 *
 * Bei gleichem Wert entscheidet die Nummer: so steht die Liste bei jedem
 * Rendern gleich da, und die Ordnung ist die, die alle kennen. Bei
 * „Bewertung" stehen POIs ohne Bewertung am Ende -- keine Bewertung ist
 * etwas anderes als eine schlechte.
 */
export function sortiertePois(pois: Poi[], sortierung: PoiSortierung): Poi[] {
  const nachNummer = (a: Poi, b: Poi) => a.number - b.number;

  return [...pois].sort((a, b) => {
    switch (sortierung) {
      case "name":
        return a.name.localeCompare(b.name, "de") || nachNummer(a, b);
      case "status":
        return statusRang(a) - statusRang(b) || nachNummer(a, b);
      case "bewertung": {
        const noteA = typeof a.bewertung === "number" ? a.bewertung : null;
        const noteB = typeof b.bewertung === "number" ? b.bewertung : null;
        // Ohne Bewertung ans Ende, untereinander wieder nach Nummer.
        if (noteA === null || noteB === null) {
          if (noteA === noteB) return nachNummer(a, b);
          return noteA === null ? 1 : -1;
        }
        // Die beste zuerst -- danach sucht, wer nach Bewertung sortiert.
        return noteB - noteA || nachNummer(a, b);
      }
      default:
        return nachNummer(a, b);
    }
  });
}
