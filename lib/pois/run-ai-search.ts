import type { Poi, PoiTypeFilter } from "./types";

export interface AiSearchApiOutcome {
  addedCount: number;
  discardedCount: number;
  createdPois: Poi[];
}

/**
 * Loest die serverseitige KI-Suche aus (siehe req-014). Liefert null, wenn
 * die Suche fehlschlaegt -- die POI-Liste bleibt dann unveraendert und der
 * Aufrufer zeigt einen Hinweis darauf.
 */
export async function runAiPoiSearch(
  tripId: string,
  typeFilter: PoiTypeFilter,
  wish: string,
): Promise<AiSearchApiOutcome | null> {
  let response: Response;
  try {
    response = await fetch("/api/poi-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, typeFilter, wish }),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  try {
    return (await response.json()) as AiSearchApiOutcome;
  } catch {
    return null;
  }
}
