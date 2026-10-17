import { formatKosten } from "../pois/kosten";

/**
 * Ein Betrag, wie er im gedruckten Reiseplan steht (req-080): „252 €" statt
 * „252,00 €".
 *
 * Im Heft stehen Betraege in grosser Schrift und in Prosa; zwei Nullen hinter
 * dem Komma lesen sich dort wie eine Rechnung. Krumme Betraege behalten ihre
 * Cent -- gerundet wird nichts.
 */
export function druckBetrag(cent: number): string {
  return cent % 100 === 0
    ? `${Math.round(cent / 100)} €`
    : `${formatKosten(cent)} €`;
}
