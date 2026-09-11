import type { Poi } from "./types";

/**
 * Die Kosten eines POI je Person (req-061). Gerechnet und gespeichert wird
 * in Cent; eingetippt und angezeigt wird in Euro mit Komma — „12,50".
 *
 * Die Waehrung ist immer Euro: andere gibt es hier bewusst nicht (req-061,
 * Out of Scope).
 */

/**
 * Die Obergrenze eines Betrags: eine Million Euro je Person. Sie haelt die
 * Spalte (integer) weit unter ihrer Grenze und faengt zugleich den
 * verrutschten Tastendruck ab -- ein Eintrittspreis ist keine Million.
 */
export const POI_KOSTEN_MAX_CENT = 100_000_000;

/**
 * Die eingetippten Kosten als Cent (req-061). Leer ergibt null -- das heisst
 * "nicht eingetragen" und ist etwas anderes als "kostet nichts" (0).
 *
 * Angenommen wird die deutsche Schreibweise mit Komma und die mit Punkt;
 * hoechstens zwei Nachkommastellen, ein Euro-Zeichen dahinter stoert nicht.
 * Alles Uebrige -- Buchstaben, ein negativer Betrag, mehr als zwei
 * Nachkommastellen -- ist ungueltig: geraten wird an einem Geldbetrag nichts.
 */
export function parseKosten(raw: string): number | null | "ungueltig" {
  const trimmed = raw.trim().replace(/\s*€$/, "").trim();
  if (trimmed.length === 0) return null;

  const treffer = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(trimmed);
  if (!treffer) return "ungueltig";

  const euro = Number(treffer[1]);
  // Eine einzelne Nachkommastelle sind Zehntel-Euro: "12,5" ist 12,50 €.
  const cent = Number((treffer[2] ?? "").padEnd(2, "0"));
  const gesamt = euro * 100 + cent;
  if (!Number.isSafeInteger(gesamt)) return "ungueltig";
  if (gesamt > POI_KOSTEN_MAX_CENT) return "ungueltig";
  return gesamt;
}

/** Ein Betrag in Cent als Eingabe fuer das Formular: „12,50". */
export function formatKosten(cent: number): string {
  return (cent / 100).toFixed(2).replace(".", ",");
}

/**
 * Die Kosten eines POI, wie sie in seiner Box stehen (req-061): „12,50 € pro
 * Person". Der Zusatz gehoert dazu -- ohne ihn liest sich der Betrag wie der
 * Preis fuer die ganze Gruppe.
 *
 * Liefert null, wenn keine eingetragen sind -- dann steht in der Box auch
 * nichts.
 */
export function kostenText(poi: Pick<Poi, "kostenCent">): string | null {
  if (typeof poi.kostenCent !== "number") return null;
  return `${formatKosten(poi.kostenCent)} € pro Person`;
}
