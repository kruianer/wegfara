import type { Poi, PoiTypeFilter } from "./types";
import {
  istGoogleFotoProblem,
  type GoogleFotoProblem,
} from "./google-foto-problem";

export interface AiSearchApiOutcome {
  addedCount: number;
  discardedCount: number;
  createdPois: Poi[];
  /**
   * Warum die Bilder der gefundenen POIs fehlen (bug-027); null heisst, dass
   * jedes Bild abgelegt wurde. Die POIs sind in jedem Fall angelegt.
   */
  fotoProblem: GoogleFotoProblem | null;
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
    const payload = (await response.json()) as AiSearchApiOutcome;
    return {
      ...payload,
      fotoProblem: istGoogleFotoProblem(payload.fotoProblem)
        ? payload.fotoProblem
        : null,
    };
  } catch {
    return null;
  }
}
