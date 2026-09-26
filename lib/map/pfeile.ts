import type { ActivityPosition } from "@/lib/activities/types";
import type { DayMapLine } from "./day-map";

/**
 * Ein Richtungspfeil auf einer Verbindungslinie der Tageskarte (req-075).
 *
 * Er sagt, was die Linie allein nicht sagt: wohin es geht. Gezeichnet wird er
 * auf der halben Strecke seiner Linie -- dort liegt er weit genug von beiden
 * Markern entfernt, um deren Nummern nicht zu verdecken.
 */
export interface RoutenPfeil {
  /** Wo er sitzt: auf der halben Strecke der Linie. */
  position: ActivityPosition;
  /**
   * Wohin er zeigt, in Grad ab Norden im Uhrzeigersinn -- unmittelbar als
   * Drehung eines nach oben zeigenden Zeichens verwendbar. Die Karte steht in
   * Mercator, und der ist winkeltreu: derselbe Winkel gilt auf der Kugel wie
   * auf dem Bildschirm.
   */
  winkel: number;
  /**
   * POI-Nummer des frueheren Programmpunkts -- dieselbe, die sein Marker traegt
   * (bug-055); null, wo er keine hat.
   */
  vonPoiNummer: number | null;
  /** POI-Nummer des spaeteren Programmpunkts. */
  nachPoiNummer: number | null;
}

/**
 * Die Richtungspfeile zu den Linien eines Reisetages (req-075). Sie entstehen
 * aus derselben Zeichnung, die die Karte ohnehin fuehrt (siehe day-map.ts):
 * wo die Linie dem Strassenverlauf folgt, folgt ihr auch der Pfeil.
 *
 * Eine Linie ohne Ausdehnung -- zwei Programmpunkte am selben Ort -- hat keine
 * Richtung und bekommt deshalb keinen Pfeil.
 */
export function routenPfeile(lines: DayMapLine[]): RoutenPfeil[] {
  const pfeile: RoutenPfeil[] = [];
  for (const line of lines) {
    const pfeil = pfeilAuf(line);
    if (pfeil) pfeile.push(pfeil);
  }
  return pfeile;
}

function pfeilAuf(line: DayMapLine): RoutenPfeil | null {
  const roh = line.verlauf;
  if (roh.length < 2) return null;

  // Ein Bezugsbreitengrad fuer die ganze Linie: nur so lassen sich die
  // Laengen ihrer Abschnitte miteinander verrechnen.
  const bezug = (roh[0].lat + roh[roh.length - 1].lat) / 2;
  const punkte = ohneStillstand(roh, bezug);
  if (punkte.length < 2) return null;

  const abschnitte = punkte
    .slice(1)
    .map((punkt, index) => abstand(punkte[index], punkt, bezug));
  const gesamt = abschnitte.reduce((summe, laenge) => summe + laenge, 0);

  // Den Abschnitt suchen, auf dem die halbe Strecke liegt.
  let rest = gesamt / 2;
  let index = 0;
  while (index < abschnitte.length - 1 && rest > abschnitte[index]) {
    rest -= abschnitte[index];
    index += 1;
  }

  const von = punkte[index];
  const nach = punkte[index + 1];
  const anteil = rest / abschnitte[index];

  return {
    position: {
      lat: von.lat + (nach.lat - von.lat) * anteil,
      lng: von.lng + (nach.lng - von.lng) * anteil,
    },
    winkel: winkelZwischen(von, nach, bezug),
    vonPoiNummer: line.vonPoiNummer,
    nachPoiNummer: line.nachPoiNummer,
  };
}

/**
 * Der Verlauf ohne Punkte, die auf ihrem Vorgaenger liegen. Ein Abschnitt
 * ohne Laenge hat keine Richtung -- und er taeuschte eine vor, wenn die halbe
 * Strecke gerade auf ihm endete.
 */
function ohneStillstand(
  verlauf: ActivityPosition[],
  bezug: number,
): ActivityPosition[] {
  return verlauf.filter(
    (punkt, index) =>
      index === 0 || abstand(verlauf[index - 1], punkt, bezug) > 0,
  );
}

/**
 * Der Abstand zweier Punkte, gemessen in Grad -- die Laengengrade auf den
 * Bezugsbreitengrad zusammengezogen, damit Nord-Sued und Ost-West vergleichbar
 * sind. Kein Erdmass: verglichen werden hier nur Abschnitte derselben Linie.
 */
function abstand(
  von: ActivityPosition,
  nach: ActivityPosition,
  bezug: number,
): number {
  return Math.hypot(nach.lat - von.lat, laengengradAnteil(von, nach, bezug));
}

/** Der Kurs von `von` nach `nach` in Grad ab Norden, im Uhrzeigersinn. */
function winkelZwischen(
  von: ActivityPosition,
  nach: ActivityPosition,
  bezug: number,
): number {
  const grad =
    (Math.atan2(laengengradAnteil(von, nach, bezug), nach.lat - von.lat) *
      180) /
    Math.PI;
  return (grad + 360) % 360;
}

function laengengradAnteil(
  von: ActivityPosition,
  nach: ActivityPosition,
  bezug: number,
): number {
  return (nach.lng - von.lng) * Math.cos((bezug * Math.PI) / 180);
}
