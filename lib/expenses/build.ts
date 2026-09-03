import { toEuroCents } from "./money";
import { equalShares, toEuroShares } from "./split";
import type { ExpenseDraft } from "./validate";
import type { ExpenseShare } from "./types";

/**
 * Eine geprueft erfasste Ausgabe, umgerechnet in die Waehrung der
 * Abrechnung (req-029): der Gesamtbetrag in Euro-Cent und die Anteile je
 * beteiligter Person, deren Summe genau diesen Betrag ergibt.
 *
 * `rate` ist der beim Erfassen ermittelte Kurs -- Euro je eine Einheit der
 * erfassten Waehrung. Er wird mit der Ausgabe gespeichert und danach nicht
 * mehr geaendert.
 */
export function toEuroAmounts(
  draft: ExpenseDraft,
  rate: number,
): { amountCents: number; shares: ExpenseShare[] } {
  const amountCents = toEuroCents(draft.originalAmountCents, rate);
  const participantIds = draft.shares.map((share) => share.participantId);

  // Bei gleichmaessiger Aufteilung ergeben sich die Anteile aus der
  // Teilung des Euro-Betrags -- was der Erfassende dort eingetragen
  // hatte, zaehlt nicht. So wird die Teilung serverseitig gerechnet und
  // nicht bloss nachvollzogen.
  const shares =
    draft.splitMode === "gleichmaessig"
      ? equalShares(amountCents, participantIds, draft.payerId)
      : toEuroShares(draft.shares, rate, amountCents, draft.payerId);

  return { amountCents, shares };
}
