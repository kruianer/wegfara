/**
 * Die Anzahl einer Kostenzeile (req-062): wie oft die Zeile zaehlt.
 *
 * Sie ist mit der Teilnehmerzahl der Reise vorbelegt und zieht mit ihr nach,
 * solange sie nicht von Hand geaendert wurde -- wer beim Mietauto 1
 * eingetragen hat, behaelt 1, auch wenn jemand zur Reise dazukommt. Deshalb
 * gibt es zwei verschiedene Zustaende: "nicht gesetzt" (null, zieht nach) und
 * eine eingetragene Zahl (bleibt).
 */

/**
 * Die Obergrenze: mehr als tausend Mal zaehlt keine Zeile einer Reise. Sie
 * faengt den verrutschten Tastendruck ab, bevor er in der Summe steht.
 */
export const KOSTEN_ANZAHL_MAX = 999;

/**
 * Die eingetippte Anzahl. Leer ergibt null -- dann zieht die Zeile wieder
 * mit der Teilnehmerzahl nach. Alles andere als eine ganze Zahl von 0 bis
 * KOSTEN_ANZAHL_MAX ist ungueltig: geraten wird nichts.
 */
export function parseAnzahl(raw: string): number | null | "ungueltig" {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/.test(trimmed)) return "ungueltig";

  const zahl = Number(trimmed);
  return zahl > KOSTEN_ANZAHL_MAX ? "ungueltig" : zahl;
}
