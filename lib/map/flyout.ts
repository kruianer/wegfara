/**
 * Wo das Flyout eines Kartenmarkers aufklappt (req-070).
 *
 * Es soll im sichtbaren Bereich der Karte bleiben: liegt der Marker am Rand,
 * klappt es zur anderen Seite, statt abgeschnitten zu werden. Den Ausschnitt
 * anzufassen -- zu zoomen oder zu verschieben, damit es passt -- ist dabei
 * ausdruecklich verboten (bug-048): der Ausschnitt gehoert dem Nutzer.
 *
 * Reine Geometrie, ohne Kartenbibliothek und ohne DOM: die Komponente
 * ermittelt nur, wo der Marker auf der Flaeche liegt, und setzt die hier
 * gewaehlten Klassen.
 */

/**
 * Breite des Flyouts, wo die Karte sie hergibt. Dieselbe Zahl steht als
 * `--flyout-breite` im CSS.
 */
export const FLYOUT_BREITE_PX = 240;

/**
 * Wie hoch das Flyout hoechstens wird -- Foto (120 px), Titel, Kurztext
 * (hoechstens 200 Zeichen, req-044) und Bewertung samt Abstaenden. Ein
 * Richtwert fuer die Platzwahl: gemessen wird nichts, sonst muesste das
 * Flyout erst sichtbar sein, um zu wissen, wohin es gehoert.
 */
export const FLYOUT_HOEHE_PX = 280;

/**
 * Abstand von der Spitze des Tropfens bis zur Kante des Flyouts. Dieselbe
 * Zahl steht als `--flyout-abstand` im CSS.
 */
export const FLYOUT_ABSTAND_PX = 24;

/** An welcher Seite des Markers das Flyout steht. */
export type FlyoutSeite = "links" | "rechts";

/**
 * Wie das Flyout senkrecht zur Spitze des Tropfens liegt: darueber, darunter
 * oder auf ihrer Hoehe mittig.
 */
export type FlyoutHoehe = "oben" | "unten" | "mitte";

export interface FlyoutAusrichtung {
  seite: FlyoutSeite;
  hoehe: FlyoutHoehe;
}

export interface Punkt {
  x: number;
  y: number;
}

export interface Groesse {
  breite: number;
  hoehe: number;
}

/** Ein Rechteck auf der Kartenflaeche, in Pixeln von ihrer linken oberen Ecke. */
export interface Kasten {
  links: number;
  oben: number;
  rechts: number;
  unten: number;
}

const STANDARD_GROESSE: Groesse = {
  breite: FLYOUT_BREITE_PX,
  hoehe: FLYOUT_HOEHE_PX,
};

/**
 * Wie breit das Flyout auf einer Karte dieser Breite sein darf, damit es
 * neben JEDEM Marker ganz auf sie passt -- auch neben einem in ihrer Mitte,
 * wo beide Seiten gleich wenig Platz bieten.
 *
 * Es ist bewusst dieselbe Breite fuer alle Marker einer Karte und nicht je
 * Marker der verfuegbare Platz: ein Flyout, das mal breiter und mal schmaler
 * aufklappt, waehrend man die Tropfen der Reihe nach ueberfaehrt, ist
 * unruhiger als eines, das immer gleich aussieht.
 *
 * Die schmalste Karte des Planers ist dabei die Messlatte: er verlangt
 * mindestens 1180 px (lib/plan/viewport.ts), von denen die Liste links den
 * groesseren Teil bekommt.
 */
export function flyoutBreite(
  karteBreite: number,
  abstand = FLYOUT_ABSTAND_PX,
): number {
  return Math.max(0, Math.min(FLYOUT_BREITE_PX, karteBreite / 2 - abstand));
}

/** In dieser Reihenfolge wird probiert -- die erste passende Lage gewinnt. */
const SEITEN: FlyoutSeite[] = ["rechts", "links"];
const HOEHEN: FlyoutHoehe[] = ["oben", "unten", "mitte"];

/**
 * Wo das Flyout liegt, wenn es so ausgerichtet wird. Bezugspunkt ist die
 * Spitze des Tropfens -- der Ort des POI.
 */
export function flyoutKasten(
  ausrichtung: FlyoutAusrichtung,
  marker: Punkt,
  flyout: Groesse = STANDARD_GROESSE,
  abstand = FLYOUT_ABSTAND_PX,
): Kasten {
  const links =
    ausrichtung.seite === "rechts"
      ? marker.x + abstand
      : marker.x - abstand - flyout.breite;
  const oben =
    ausrichtung.hoehe === "oben"
      ? marker.y - flyout.hoehe
      : ausrichtung.hoehe === "unten"
        ? marker.y
        : marker.y - flyout.hoehe / 2;
  return {
    links,
    oben,
    rechts: links + flyout.breite,
    unten: oben + flyout.hoehe,
  };
}

/**
 * Wie das Flyout eines Markers aufklappt, damit es ganz auf der Karte liegt.
 *
 * Vorgezogen wird rechts vom Marker und ueber seiner Spitze -- dort verdeckt
 * es am wenigsten von dem, was man gerade ansieht. Passt das nicht, klappt es
 * zur anderen Seite beziehungsweise nach unten.
 *
 * Waagerecht passt immer eine der beiden Seiten, solange die Breite aus
 * `flyoutBreite` kommt. Senkrecht gilt dasselbe, solange die Karte mindestens
 * doppelt so hoch ist wie das Flyout; ist sie flacher, bleibt nur die mittige
 * Lage -- abgeschnitten wird dann ohnehin, aber so wenig wie moeglich.
 */
export function flyoutAusrichtung(
  marker: Punkt,
  karte: Groesse,
  flyout: Groesse = STANDARD_GROESSE,
  abstand = FLYOUT_ABSTAND_PX,
): FlyoutAusrichtung {
  const seite =
    SEITEN.find((seite) => {
      const kasten = flyoutKasten(
        { seite, hoehe: "oben" },
        marker,
        flyout,
        abstand,
      );
      return kasten.links >= 0 && kasten.rechts <= karte.breite;
    }) ?? (marker.x > karte.breite - marker.x ? "links" : "rechts");

  const hoehe =
    HOEHEN.find((hoehe) => {
      const kasten = flyoutKasten({ seite, hoehe }, marker, flyout, abstand);
      return kasten.oben >= 0 && kasten.unten <= karte.hoehe;
    }) ?? "mitte";

  return { seite, hoehe };
}
