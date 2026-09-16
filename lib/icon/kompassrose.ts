/**
 * Das Zeichen der Marke als Pfaddaten -- die eine Quelle fuer die
 * Kompassrose (req-065).
 *
 * `components/compass-icon.tsx` zeichnet damit die Rose auf der Anmeldeseite
 * und in der Bereichsleiste; das Icon fuer Browser-Tab und Homescreen baut
 * aus denselben Pfaden sein Bild. Ein zweites Zeichen darf es nicht geben --
 * deshalb stehen die Pfade hier und nicht in der Komponente.
 */

/** Die Kantenlaenge des Koordinatensystems, in dem die Pfade liegen. */
export const KOMPASSROSE_VIEWBOX = 24;

/** Der aeussere, nur umrissene Stern. */
export const KOMPASSROSE_AUSSEN =
  "M12 2.5 L14.6 9.4 L21.5 12 L14.6 14.6 L12 21.5 L9.4 14.6 L2.5 12 L9.4 9.4 Z";

/** Der innere, gefuellte Stern. */
export const KOMPASSROSE_INNEN =
  "M12 5.5 L13.6 10.4 L18.5 12 L13.6 13.6 L12 18.5 L10.4 13.6 L5.5 12 L10.4 10.4 Z";

/** Die Strichstaerke des aeusseren Umrisses, in Einheiten der viewBox. */
export const KOMPASSROSE_STRICHSTAERKE = 1.3;

/**
 * Wie viel der Icon-Flaeche die Rose einnimmt. Der Rest ist Rand: ein
 * Zeichen, das bis an die Kante laeuft, wirkt auf dem Homescreen gedraengt --
 * und Apple schneidet das Icon selbst rund zu.
 */
export const KOMPASSROSE_ANTEIL = 0.8;

export interface IconFarben {
  /** Die Grundflaeche, auf der die Rose liegt. */
  grund: string;
  /** Die Farbe der Rose selbst. */
  zeichen: string;
}

/**
 * Das vollstaendige Icon als SVG: erst die deckende Grundflaeche, darauf die
 * mittig eingerueckte Kompassrose.
 *
 * Die Flaeche ist bewusst deckend und nicht durchsichtig -- Apple fuellt
 * durchsichtige Bereiche eines Homescreen-Icons mit Schwarz, und genau das
 * soll nicht passieren (req-065).
 */
export function kompassroseIconSvg(
  groesse: number,
  farben: IconFarben,
): string {
  const rand = (KOMPASSROSE_VIEWBOX * (1 - KOMPASSROSE_ANTEIL)) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${groesse}" height="${groesse}"`,
    ` viewBox="0 0 ${KOMPASSROSE_VIEWBOX} ${KOMPASSROSE_VIEWBOX}">`,
    `<rect width="${KOMPASSROSE_VIEWBOX}" height="${KOMPASSROSE_VIEWBOX}" fill="${farben.grund}"/>`,
    `<g transform="translate(${rand} ${rand}) scale(${KOMPASSROSE_ANTEIL})">`,
    `<path d="${KOMPASSROSE_AUSSEN}" fill="none" stroke="${farben.zeichen}"`,
    ` stroke-width="${KOMPASSROSE_STRICHSTAERKE}" stroke-linejoin="round"/>`,
    `<path d="${KOMPASSROSE_INNEN}" fill="${farben.zeichen}"/>`,
    `</g></svg>`,
  ].join("");
}
