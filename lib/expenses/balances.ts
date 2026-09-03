import type { Expense } from "./types";

/**
 * Der Saldo einer Person (req-030): die Differenz zwischen dem, was sie
 * ausgelegt hat, und dem, was auf sie entfaellt. Er wird aus den Ausgaben
 * gerechnet und nirgends gespeichert -- sonst koennten beide auseinander
 * laufen (req-030, Constraints).
 */
export interface Balance {
  participantId: string;
  /** Was die Person fuer die Gruppe ausgelegt hat, in Euro-Cent. */
  paidCents: number;
  /** Was von den Ausgaben auf sie entfaellt, in Euro-Cent. */
  shareCents: number;
  /**
   * `paidCents - shareCents`: positiv, wenn sie Geld bekommt, negativ, wenn
   * sie schuldet. Die Summe aller Salden ist immer null -- jeder Cent, den
   * jemand ausgelegt hat, entfaellt auf genau eine beteiligte Person.
   */
  balanceCents: number;
}

/** Die Gesamtsumme aller Ausgaben in Euro-Cent (req-030, Zusammenfassung). */
export function totalExpenseCents(expenses: Expense[]): number {
  return expenses.reduce((summe, expense) => summe + expense.amountCents, 0);
}

/** Wer in einer Ausgabe vorkommt: der Zahler und alle Beteiligten. */
function peopleOf(expense: Expense): string[] {
  return [
    expense.payerId,
    ...expense.shares.map((share) => share.participantId),
  ];
}

/**
 * Die Salden je Teilnehmer, in der Reihenfolge der uebergebenen Personen.
 *
 * Wer in den Ausgaben vorkommt, aber nicht mehr Teilnehmer der Reise ist,
 * wird hinten angehaengt: sein Saldo verschwaende sonst, und die Summe
 * aller Salden ergaebe nicht mehr null.
 */
export function computeBalances(
  expenses: Expense[],
  participantIds: string[],
): Balance[] {
  const ids = [...participantIds];
  const bekannt = new Set(ids);
  for (const expense of expenses) {
    for (const id of peopleOf(expense)) {
      if (!bekannt.has(id)) {
        bekannt.add(id);
        ids.push(id);
      }
    }
  }

  const ausgelegt = new Map<string, number>();
  const entfaellt = new Map<string, number>();
  for (const expense of expenses) {
    ausgelegt.set(
      expense.payerId,
      (ausgelegt.get(expense.payerId) ?? 0) + expense.amountCents,
    );
    for (const share of expense.shares) {
      entfaellt.set(
        share.participantId,
        (entfaellt.get(share.participantId) ?? 0) + share.amountCents,
      );
    }
  }

  return ids.map((participantId) => {
    const paidCents = ausgelegt.get(participantId) ?? 0;
    const shareCents = entfaellt.get(participantId) ?? 0;
    return {
      participantId,
      paidCents,
      shareCents,
      balanceCents: paidCents - shareCents,
    };
  });
}

/** Der Saldo einer bestimmten Person -- null, wenn sie nirgends vorkommt. */
export function balanceOf(balances: Balance[], participantId: string): number {
  const eigener = balances.find(
    (balance) => balance.participantId === participantId,
  );
  return eigener?.balanceCents ?? 0;
}
