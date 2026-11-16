/**
 * Blaettern in einer waagerecht rollenden Leiste mit ausgeblendetem
 * Bildlaufbalken (req-110) -- zuerst die Tagauswahl der Planung, spaeter
 * ebenso die Tagauswahl des Begleiters und die Options-Karten.
 *
 * Hier steht nur die Rechnung: ob geblaettert werden kann und wohin. Gemessen
 * wird in der Oberflaeche (`components/blaetter-leiste.tsx`); ob es etwas zu
 * blaettern gibt, entscheidet allein der gemessene Platz, nie die Zahl der
 * Eintraege.
 */

/** Was eine rollende Leiste ueber ihren Bildlauf meldet. */
export interface Bildlauf {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

/** Lage eines Eintrags im Inhalt der Leiste (`offsetLeft`, `offsetWidth`). */
export interface Spanne {
  links: number;
  breite: number;
}

/**
 * Bruchteile eines Pixels gelten nicht: bei Zoom oder krummer Spaltenbreite
 * meldet der Browser `scrollWidth` gerundet, `scrollLeft` dagegen nicht.
 */
const TOLERANZ_PX = 1;

export type Richtung = "zurueck" | "vor";

export interface BlaetterZustand {
  /** Die Leiste hat mehr Inhalt als Breite -- die Knoepfe stehen da. */
  noetig: boolean;
  /** Es geht nach hinten weiter. */
  zurueck: boolean;
  /** Es geht nach vorn weiter. */
  vor: boolean;
}

function groessterBildlauf(bildlauf: Bildlauf): number {
  return Math.max(0, bildlauf.scrollWidth - bildlauf.clientWidth);
}

function begrenzt(wert: number, bildlauf: Bildlauf): number {
  return Math.min(Math.max(0, wert), groessterBildlauf(bildlauf));
}

export function blaetterZustand(bildlauf: Bildlauf): BlaetterZustand {
  const groesster = groessterBildlauf(bildlauf);
  const noetig = groesster > TOLERANZ_PX;
  return {
    noetig,
    zurueck: noetig && bildlauf.scrollLeft > TOLERANZ_PX,
    vor: noetig && bildlauf.scrollLeft < groesster - TOLERANZ_PX,
  };
}

/**
 * Der Bildlauf nach einem Schritt um genau einen Eintrag: Nach vorn steht
 * danach der naechste Eintrag am linken Rand, nach hinten der vorige. Steht
 * die Leiste zwischen zwei Eintraegen (nach einem Wisch), rueckt der Schritt
 * auf den naechsten Anfang in dieser Richtung -- nie halb darueber hinaus.
 *
 * Gemessen wird ab dem ersten Eintrag: ein Innenabstand der Leiste vor ihm
 * bleibt so beim Blaettern derselbe wie in der Ausgangslage.
 */
export function blaetterZiel(
  eintraege: readonly Spanne[],
  bildlauf: Bildlauf,
  richtung: Richtung,
): number {
  if (eintraege.length === 0) return bildlauf.scrollLeft;
  const einzug = eintraege[0].links;
  const anfaenge = eintraege.map((eintrag) => eintrag.links - einzug);
  const jetzt = bildlauf.scrollLeft;

  const ziel =
    richtung === "vor"
      ? anfaenge.find((anfang) => anfang > jetzt + TOLERANZ_PX)
      : [...anfaenge].reverse().find((anfang) => anfang < jetzt - TOLERANZ_PX);

  if (ziel === undefined) {
    return richtung === "vor" ? groessterBildlauf(bildlauf) : 0;
  }
  return begrenzt(ziel, bildlauf);
}

/**
 * Der Bildlauf, bei dem ein Eintrag ganz zu sehen ist -- unveraendert, wenn
 * er es schon ist. Ragt er links hinaus, kommt er an den linken Rand, ragt
 * er rechts hinaus, an den rechten; beide Male mit dem Innenabstand, mit dem
 * der erste Eintrag in der Ausgangslage steht (`einzug`).
 */
export function insBildZiel(
  eintrag: Spanne,
  bildlauf: Bildlauf,
  einzug = 0,
): number {
  const anfang = eintrag.links - einzug;
  const ende = eintrag.links + eintrag.breite + einzug;
  if (anfang < bildlauf.scrollLeft) return begrenzt(anfang, bildlauf);
  if (ende > bildlauf.scrollLeft + bildlauf.clientWidth) {
    return begrenzt(ende - bildlauf.clientWidth, bildlauf);
  }
  return bildlauf.scrollLeft;
}
