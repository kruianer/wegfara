import { HOUR_HEIGHT_PX } from "./timeline-grid";

/**
 * Der Zoom des Zeitstrahls (req-076): dieselbe Stunde wird hoeher oder
 * niedriger dargestellt. Groesser gezeichnet bekommt eine Viertelstunde mehr
 * Pixel und laesst sich deshalb genauer ziehen; kleiner gezeichnet sind mehr
 * Stunden auf einen Blick zu sehen.
 *
 * Der Zoom ist allein eine Frage der Darstellung: das Raster bleibt bei 15
 * Minuten (req-039, req-040), und die Zeiten der Programmpunkte aendert er
 * nicht. Gerechnet wird ueberall mit der Stundenhoehe, die im Raster steht
 * (`hourHeightPx` in lib/plan/timeline-grid.ts) -- eine zweite Quelle fuer
 * dieselbe Zahl liesse einen gezogenen POI auf einer anderen Zeit landen als
 * der, auf die er gezogen wurde (req-076, Constraints).
 */

/**
 * Die Stufen des Zooms in Pixeln je Stunde, von der flachsten zur hoechsten.
 *
 * Die Unter- und Obergrenze sind bewusst gesetzt (req-076, Constraints): 24 px
 * je Stunde ist die Hoehe, die ein Block mindestens braucht, damit Nummer und
 * Titel ganz darin stehen (req-074, `min-height` in
 * timeline-column.module.css) -- flacher wuerde nichts mehr lesbar. 96 px sind
 * das Doppelte der Grundeinstellung; ein voller Reisetag bleibt damit in
 * wenigen Bildlaeufen zu ueberblicken.
 */
export const ZOOM_STUFEN_PX = [24, 32, HOUR_HEIGHT_PX, 72, 96];

/** Die flachste Stufe -- kleiner wird der Zeitstrahl nicht. */
export const ZOOM_MIN_PX = ZOOM_STUFEN_PX[0];

/** Die hoechste Stufe -- groesser wird der Zeitstrahl nicht. */
export const ZOOM_MAX_PX = ZOOM_STUFEN_PX[ZOOM_STUFEN_PX.length - 1];

/**
 * Die Grundeinstellung: dieselbe Stundenhoehe, die der Zeitstrahl vor req-076
 * hatte. Wer nichts zoomt, sieht denselben Zeitstrahl wie bisher.
 */
export const ZOOM_GRUNDSTUFE_PX = HOUR_HEIGHT_PX;

/** Die naechsthoehere Stufe -- auf der hoechsten bleibt es bei ihr. */
export function groessereStundenhoehePx(hourHeightPx: number): number {
  return ZOOM_STUFEN_PX.find((stufe) => stufe > hourHeightPx) ?? ZOOM_MAX_PX;
}

/** Die naechstflachere Stufe -- auf der flachsten bleibt es bei ihr. */
export function kleinereStundenhoehePx(hourHeightPx: number): number {
  return (
    [...ZOOM_STUFEN_PX].reverse().find((stufe) => stufe < hourHeightPx) ??
    ZOOM_MIN_PX
  );
}

/** Ob schon die hoechste Stufe erreicht ist -- dann ist "größer" stumm. */
export function istGroessteStundenhoehe(hourHeightPx: number): boolean {
  return hourHeightPx >= ZOOM_MAX_PX;
}

/** Ob schon die flachste Stufe erreicht ist -- dann ist "kleiner" stumm. */
export function istKleinsteStundenhoehe(hourHeightPx: number): boolean {
  return hourHeightPx <= ZOOM_MIN_PX;
}
