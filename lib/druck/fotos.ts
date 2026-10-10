import type { Poi } from "../pois/types";
import { istKiBild } from "../pois/ki-bild";
import { kleineFotoAnzahl } from "./layouts";
import type { DruckFoto, StationLayout } from "./types";

/**
 * Welche Fotos eines POI im Heft erscheinen (req-080).
 *
 * Bis zu sieben Fotos koennen am POI liegen (req-068); im Heft erscheinen ein
 * grosses und, je nach Layout, zwei oder drei kleine. Genommen werden die
 * ersten in ihrer Reihenfolge -- auswaehlbar ist das vorerst nicht
 * (req-080, Out of Scope).
 */

/** Die Fotos eines POI in ihrer Reihenfolge; ohne POI gibt es keine. */
export function druckFotos(poi: Poi | undefined): DruckFoto[] {
  return [...(poi?.photos ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((photo) => ({ id: photo.id, istKiBild: istKiBild(photo) }));
}

/**
 * Das grosse Foto und die kleinen einer Station.
 *
 * Hat ein POI nur ein Foto, fallen die kleinen weg -- das eine Foto fuellt
 * dann den Bildbereich, und es bleibt keine leere Flaeche (req-080). Hat er
 * gar keines, bleibt der Bildbereich ganz aus.
 */
export function stationFotos(
  fotos: DruckFoto[],
  layout: StationLayout,
): { grossesFoto: DruckFoto | null; kleineFotos: DruckFoto[] } {
  return {
    grossesFoto: fotos[0] ?? null,
    kleineFotos: fotos.slice(1, 1 + kleineFotoAnzahl(layout)),
  };
}
