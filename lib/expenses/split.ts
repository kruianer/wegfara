import { formatMoney } from "./money";
import type { Currency, ExpenseShare } from "./types";

/**
 * Das Aufteilen einer Ausgabe (req-029). Zwei Regeln gelten fuer beide
 * Arten der Aufteilung:
 *
 * - Die Summe der Anteile ergibt immer genau den Gesamtbetrag. Eine
 *   Teilung, die nicht aufgeht, laesst hoechstens wenige Cent uebrig --
 *   die traegt der Zahler.
 * - Wer nicht beteiligt ist, bekommt keinen Anteil. Ist der Zahler selbst
 *   nicht beteiligt, hat er nur ausgelegt; den Rest traegt dann die erste
 *   beteiligte Person, damit die Summe trotzdem stimmt.
 */

/** Wer den Rest der Teilung traegt: der Zahler, sonst der erste Beteiligte. */
function restTraeger(participantIds: string[], payerId: string): string {
  return participantIds.includes(payerId) ? payerId : participantIds[0];
}

/**
 * Teilt den Betrag gleichmaessig auf die Beteiligten. Der Rest von wenigen
 * Cent geht an den Zahler.
 */
export function equalShares(
  totalCents: number,
  participantIds: string[],
  payerId: string,
): ExpenseShare[] {
  if (participantIds.length === 0) return [];

  const base = Math.floor(totalCents / participantIds.length);
  const rest = totalCents - base * participantIds.length;
  const traeger = restTraeger(participantIds, payerId);

  return participantIds.map((participantId) => ({
    participantId,
    amountCents: base + (participantId === traeger ? rest : 0),
  }));
}

/**
 * Rechnet individuell erfasste Anteile in Euro um. Jeder Anteil wird
 * einzeln gerundet; die dabei entstehende Abweichung zum umgerechneten
 * Gesamtbetrag traegt der Zahler -- so bleibt die Summe der Anteile genau
 * der Gesamtbetrag.
 *
 * Bei Euro (Kurs 1) ist das Ergebnis identisch mit der Eingabe.
 */
export function toEuroShares(
  shares: ExpenseShare[],
  rate: number,
  totalEuroCents: number,
  payerId: string,
): ExpenseShare[] {
  if (shares.length === 0) return [];

  const umgerechnet = shares.map((share) => ({
    participantId: share.participantId,
    amountCents: Math.round(share.amountCents * rate),
  }));

  const traeger = restTraeger(
    umgerechnet.map((share) => share.participantId),
    payerId,
  );
  const rest = totalEuroCents - sumShares(umgerechnet);

  return umgerechnet.map((share) => ({
    participantId: share.participantId,
    amountCents:
      share.amountCents + (share.participantId === traeger ? rest : 0),
  }));
}

/** Die Summe der Anteile. */
export function sumShares(shares: ExpenseShare[]): number {
  return shares.reduce((summe, share) => summe + share.amountCents, 0);
}

/**
 * Was zum Gesamtbetrag noch fehlt: positiv, solange die Anteile darunter
 * liegen, negativ, wenn sie darueber hinausgehen, null bei Gleichstand.
 */
export function shareDifference(
  totalCents: number,
  shares: ExpenseShare[],
): number {
  return totalCents - sumShares(shares);
}

/**
 * Wie die Abweichung genannt wird (req-029): weicht die Summe der Anteile
 * vom Gesamtbetrag ab, wird nicht gespeichert und die Abweichung benannt.
 */
export function shareDifferenceText(
  difference: number,
  currency: Currency,
): string {
  if (difference === 0) return "Die Anteile ergeben den Gesamtbetrag.";
  return difference > 0
    ? `Es fehlen noch ${formatMoney(difference, currency)}.`
    : `${formatMoney(-difference, currency)} zu viel.`;
}
