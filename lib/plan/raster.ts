/**
 * Das Raster des Zeitstrahls (req-082): wie fein eine Startzeit oder eine
 * Dauer einrastet. 15 Minuten ist die Vorgabe, wie vor req-082 (req-039,
 * req-040); 5 Minuten sind die Feinarbeit. Eine einzige Stelle fuer beide
 * Werte -- vorher standen sie dreifach getrennt in move-activity.ts,
 * plan-poi.ts und tagesplan.ts, dazu `DURATION_STEP_MINUTES` in
 * estimated-duration.ts (Constraints).
 */
export type RasterMinuten = 15 | 5;

/**
 * Die Vorgabe -- und das Raster, mit dem die KI-Planung weiterhin rechnet
 * (req-056, Out of Scope: sie bleibt bei Viertelstunden, unabhaengig vom
 * gewaehlten Raster).
 */
export const GRUNDRASTER_MINUTEN: RasterMinuten = 15;

/** Fuer die Feinarbeit (req-082, Funktion). */
export const FEINES_RASTER_MINUTEN: RasterMinuten = 5;

/** Die beiden waehlbaren Stufen, in der Reihenfolge des Umschalters. */
export const RASTER_OPTIONEN: RasterMinuten[] = [
  GRUNDRASTER_MINUTEN,
  FEINES_RASTER_MINUTEN,
];

/**
 * Liest das Raster aus einer Anfrage (req-082): das Raster ist reine
 * Oberflaechen-Einstellung und wird nie gespeichert (Out of Scope) -- die
 * Anfrage sagt deshalb mit, in welchem Raster der Nutzer gerade gezogen
 * hat. Alles, was nicht die Feinarbeit ist -- auch eine fehlende oder
 * kaputte Angabe --, gilt als die Vorgabe.
 */
export function parseRaster(value: unknown): RasterMinuten {
  return value === FEINES_RASTER_MINUTEN
    ? FEINES_RASTER_MINUTEN
    : GRUNDRASTER_MINUTEN;
}
