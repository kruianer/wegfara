import type { Participant } from "../participants/types";

/**
 * Die Waehrungen, in denen eine Ausgabe erfasst werden kann (req-029).
 * Euro ist die Waehrung der Abrechnung; die uebrigen drei werden beim
 * Erfassen in Euro umgerechnet. Weitere sind bewusst nicht Teil des
 * Requirements.
 */
export const CURRENCIES = ["EUR", "CHF", "USD", "GBP"] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" &&
    (CURRENCIES as readonly string[]).includes(value)
  );
}

/**
 * Wie der Betrag auf die Beteiligten verteilt wird (req-029):
 * `gleichmaessig` teilt durch die Zahl der Beteiligten, `individuell`
 * uebernimmt je Person den eingetragenen Betrag.
 */
export const SPLIT_MODES = ["gleichmaessig", "individuell"] as const;

export type SplitMode = (typeof SPLIT_MODES)[number];

export function isSplitMode(value: unknown): value is SplitMode {
  return (
    typeof value === "string" &&
    (SPLIT_MODES as readonly string[]).includes(value)
  );
}

/** Was auf eine beteiligte Person entfaellt, in Euro-Cent. */
export interface ExpenseShare {
  participantId: string;
  amountCents: number;
}

/**
 * Eine erfasste Ausgabe einer Reise (req-029). Alle Betraege liegen als
 * ganze Cent vor -- bei Geld muss die Summe der Anteile den Gesamtbetrag
 * exakt treffen.
 */
export interface Expense {
  id: string;
  tripId: string;
  title: string;
  /** Der Gesamtbetrag in Euro-Cent -- die Waehrung der Abrechnung. */
  amountCents: number;
  /** Der erfasste Betrag in der kleinsten Einheit seiner Waehrung. */
  originalAmountCents: number;
  currency: Currency;
  /**
   * Euro je eine Einheit der erfassten Waehrung, beim Erfassen ermittelt
   * und mit der Ausgabe gespeichert. Bei Euro 1.
   */
  exchangeRate: number;
  payerId: string;
  splitMode: SplitMode;
  /** Die Anteile in Euro-Cent; ihre Summe ergibt `amountCents`. */
  shares: ExpenseShare[];
  createdAt: string;
}

/**
 * So viel einer Person, wie der Bereich "Kosten" braucht: ihr Name zum
 * Anzeigen, mehr nicht. Telefonnummer und Bankverbindung gehen den
 * Begleiter nichts an (siehe delivery/security.md) und werden gar nicht
 * erst an ihn ausgeliefert.
 */
export type ExpensePerson = Pick<Participant, "id" | "name" | "nickname">;
