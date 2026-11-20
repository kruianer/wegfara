import { gridHourHeightPx, hoursSinceDayStart } from "./timeline-grid";
import type { TimelineGrid } from "./timeline-grid";

/**
 * Wohin der Zeitstrahl beim Oeffnen eines Reisetages rollt (req-112).
 *
 * Seit req-112 reicht das Raster ueber den ganzen Tag. Bei der
 * Grundeinstellung von 48 px je Stunde ist es damit 1152 px hoch, bei
 * groesstem Zoom ueber 4000 -- sichtbar sind rund 600 bis 900. Ohne Zutun
 * stuende die Ansicht am oberen Rand, also mitten in der Nacht, in der
 * gewoehnlich nichts geplant ist.
 *
 * Deshalb rollt sie auf den ersten Programmpunkt des Tages, mit einer
 * Stunde Luft darueber -- so ist zu sehen, dass davor noch Raster ist. Ein
 * Tag ohne Programmpunkte rollt auf den Morgen.
 *
 * Die Rechnung steht hier und nicht in der Oberflaeche: `computeTimelineGrid`
 * bleibt eine reine Funktion ohne Kenntnis der Ansicht (req-112,
 * Constraints), und diese hier laesst sich fuer sich pruefen.
 */

/** Auf welche Stunde ein Tag ohne Programmpunkte rollt. */
export const LEERER_TAG_STUNDE = 7;

/** Wie viel Raster oberhalb des ersten Programmpunkts sichtbar bleibt. */
export const LUFT_STUNDEN = 1;

/**
 * Die Stunde, die beim Oeffnen oben stehen soll -- nie vor dem Rasterbeginn.
 * `activities` muss bereits auf den betrachteten Tag gefiltert sein.
 */
export function ersteSichtbareStunde(
  activities: { startAt: string }[],
  date: string,
  grid: TimelineGrid,
): number {
  const stunde =
    activities.length === 0
      ? LEERER_TAG_STUNDE
      : Math.min(...activities.map((a) => hoursSinceDayStart(a.startAt, date)));
  return Math.max(grid.startHour, Math.floor(stunde) - LUFT_STUNDEN);
}

/**
 * Wie weit die Rollflaeche von oben stehen soll, in Pixeln. Nie weiter, als
 * das Raster hergibt: Bei einem hohen Fenster und einem Programmpunkt am
 * Abend bliebe sonst unten eine Luecke, und die Ansicht sprang scheinbar
 * grundlos nicht so weit, wie sie sollte.
 */
export function rollZielPx(
  activities: { startAt: string }[],
  date: string,
  grid: TimelineGrid,
  sichtbareHoehePx: number,
): number {
  const hourHeightPx = gridHourHeightPx(grid);
  const stunde = ersteSichtbareStunde(activities, date, grid);
  const ziel = (stunde - grid.startHour) * hourHeightPx;
  const gesamt = (grid.endHour - grid.startHour) * hourHeightPx;
  return Math.max(0, Math.min(ziel, gesamt - sichtbareHoehePx));
}
