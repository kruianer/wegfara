import type { StationLayout } from "./types";

/**
 * Welches der fuenf Layouts eine Station bekommt (req-080).
 *
 * Der Wechsel folgt einer Regel, nicht dem Zufall: Zufall erzeugte
 * gelegentlich zwei gleiche hintereinander, und die Seite wirkte unruhig
 * statt lebendig.
 *
 *   1. die erste grosse Station des Tages  -> L1
 *   2. die naechste grosse                 -> L2
 *   3. danach wechselnd                    -> L3 / L4
 *   4. Nebenstationen                      -> L5
 *
 * Unter den grossen Stationen stehen damit nie zwei gleiche Layouts
 * untereinander. Zwei Nebenstationen hintereinander tragen beide L5 -- das
 * ist Absicht: L5 ist die schmale Nebenform, nicht eine von vier
 * gleichrangigen Varianten.
 */

/** Das Gewicht einer Station: eine grosse oder eine Nebenstation. */
export type StationGewicht = "gross" | "neben";

/** Die Reihenfolge der grossen Layouts: erst L1 und L2, danach L3/L4 im Wechsel. */
function grossesLayout(index: number): StationLayout {
  if (index === 0) return "l1";
  if (index === 1) return "l2";
  return index % 2 === 0 ? "l3" : "l4";
}

/**
 * Die Layouts der Stationen eines Tages, in deren Reihenfolge. Die Regel
 * zaehlt je Tag neu: jeder Tag beginnt mit L1.
 */
export function stationLayouts(gewichte: StationGewicht[]): StationLayout[] {
  let grosse = 0;
  return gewichte.map((gewicht) => {
    if (gewicht === "neben") return "l5";
    const layout = grossesLayout(grosse);
    grosse += 1;
    return layout;
  });
}

/**
 * Wie viele kleine Fotos ein Layout zeigt -- die Maße stehen im Mockup.
 * L5 zeigt ueberhaupt nur ein Bild, und das ist sein grosses.
 */
export function kleineFotoAnzahl(layout: StationLayout): number {
  switch (layout) {
    case "l1":
      return 2;
    case "l2":
      return 3;
    case "l3":
      return 3;
    case "l4":
      return 2;
    case "l5":
      return 0;
  }
}
