/**
 * Die Tagesfarben des gedruckten Reiseplans (req-103) -- je Reisetag eine
 * Farbe fuer seine Linien und Nadeln auf den Karten. Sie stehen hier und nur
 * hier; kein CSS-Modul definiert sie ein zweites Mal (vgl. req-082).
 *
 * Geprueft auf dem Kartengrund `KARTEN_GRUND` (#f2efe9) nach WCAG 2.1
 * (lib/design/kontrast.ts): alle ueber 4,5:1. Und bewusst **unterschiedlich
 * hell**, nicht nur unterschiedlich bunt -- wer das Heft schwarzweiss druckt,
 * muss die Linien trotzdem unterscheiden koennen. Benachbarte Tage liegen
 * dabei weit auseinander: hell, dunkel, hell, dunkel ...
 *
 * Die Farbtoene folgen dem Entwurf (deckblatt-und-summary.mockup.html); dort
 * waren drei von ihnen gleich hell und sind hier aufgehellt bzw. abgedunkelt.
 * Kontrast und relative Leuchtdichte stehen je Farbe dabei; tagesfarben.test.ts
 * rechnet beides nach.
 */

/** Der Grund der Karten -- die Flaeche, auf der die Linien stehen. */
export const KARTEN_GRUND = "#f2efe9";

export const TAGESFARBEN = [
  /** Rot -- 4,84:1, Leuchtdichte 0,139. */
  { name: "rot", wert: "#bf3721" },
  /** Gruen -- 9,18:1, Leuchtdichte 0,050. */
  { name: "gruen", wert: "#14473b" },
  /** Blau -- 5,45:1, Leuchtdichte 0,118. */
  { name: "blau", wert: "#2d5fae" },
  /** Braun -- 10,9:1, Leuchtdichte 0,034. */
  { name: "braun", wert: "#4b2d09" },
  /** Violett -- 6,36:1, Leuchtdichte 0,094. */
  { name: "violett", wert: "#714096" },
  /** Oliv -- 12,9:1, Leuchtdichte 0,021. */
  { name: "oliv", wert: "#2d280a" },
  /** Petrol -- 7,57:1, Leuchtdichte 0,071. */
  { name: "petrol", wert: "#1c506d" },
] as const;

/**
 * Die Farbe eines Reisetags (Nummer ab 1). Hat eine Reise mehr als sieben
 * Tage, wiederholen sich die Farben: zwei weit auseinanderliegende Tage in
 * derselben Farbe sind weniger schlimm als eine achte, die sich von keiner
 * unterscheidet.
 */
export function tagesfarbe(tagNummer: number): string {
  const index =
    (((tagNummer - 1) % TAGESFARBEN.length) + TAGESFARBEN.length) %
    TAGESFARBEN.length;
  return TAGESFARBEN[index].wert;
}
