import { POI_TYPE_LABEL } from "./type-meta";
import type { Poi } from "./types";

/**
 * Die Zeile unter dem Namen eines POI: Ort und Typ. Liess sich kein Ort
 * ableiten, steht dort allein der Typ — kein Platzhaltertext und kein
 * Trenner ins Leere (req-041).
 */
export function poiOrtUndTyp(poi: Pick<Poi, "ort" | "type">): string {
  return [poi.ort.trim(), POI_TYPE_LABEL[poi.type]]
    .filter((teil) => teil.length > 0)
    .join(" · ");
}
