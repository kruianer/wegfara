import type { Poi, PoiTypeFilter } from "./types";
import {
  istGoogleFotoProblem,
  type GoogleFotoProblem,
} from "./google-foto-problem";
import {
  istAiSearchFehler,
  UNBEKANNTER_AI_SEARCH_FEHLER,
  type AiSearchFehler,
} from "./ai-search-fehler";

export interface AiSearchApiOutcome {
  addedCount: number;
  discardedCount: number;
  createdPois: Poi[];
  /**
   * Warum die Bilder der gefundenen POIs fehlen (bug-027); null heisst, dass
   * jedes Bild abgelegt wurde. Die POIs sind in jedem Fall angelegt.
   */
  fotoProblem: GoogleFotoProblem | null;
  /**
   * Warum die Suche gar nicht lief (bug-032); null heisst, sie lief. Steht
   * hier ein Grund, ist die POI-Liste unveraendert.
   */
  fehler: AiSearchFehler | null;
}

function fehlgeschlagen(fehler: AiSearchFehler): AiSearchApiOutcome {
  return {
    addedCount: 0,
    discardedCount: 0,
    createdPois: [],
    fotoProblem: null,
    fehler,
  };
}

/** Der Grund aus der Antwort der Schnittstelle, wenn sie einen mitschickt. */
async function fehlerAus(response: Response): Promise<AiSearchFehler> {
  try {
    const payload = (await response.json()) as { fehler?: unknown };
    return istAiSearchFehler(payload.fehler)
      ? payload.fehler
      : UNBEKANNTER_AI_SEARCH_FEHLER;
  } catch {
    return UNBEKANNTER_AI_SEARCH_FEHLER;
  }
}

/**
 * Loest die serverseitige KI-Suche aus (siehe req-014). Schlaegt sie fehl,
 * traegt das Ergebnis den Grund dafuer (bug-032) -- die POI-Liste bleibt
 * dann unveraendert und der Aufrufer nennt den Grund.
 */
export async function runAiPoiSearch(
  tripId: string,
  typeFilter: PoiTypeFilter,
  wish: string,
): Promise<AiSearchApiOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/poi-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, typeFilter, wish }),
    });
  } catch {
    return fehlgeschlagen(UNBEKANNTER_AI_SEARCH_FEHLER);
  }

  if (!response.ok) return fehlgeschlagen(await fehlerAus(response));

  try {
    const payload = (await response.json()) as AiSearchApiOutcome;
    return {
      ...payload,
      fotoProblem: istGoogleFotoProblem(payload.fotoProblem)
        ? payload.fotoProblem
        : null,
      fehler: null,
    };
  } catch {
    return fehlgeschlagen(UNBEKANNTER_AI_SEARCH_FEHLER);
  }
}
