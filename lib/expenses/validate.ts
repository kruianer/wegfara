import { shareDifference } from "./split";
import type { Currency, ExpenseShare, SplitMode } from "./types";

/** Ein Titel ist erforderlich und hoechstens so lang (req-029). */
export const EXPENSE_TITLE_MAX = 80;

/**
 * Eine Ausgabe, so wie sie erfasst wird: alle Betraege in der erfassten
 * Waehrung, noch nicht in Euro umgerechnet. Geprueft wird damit in der
 * Oberflaeche und in der Schnittstelle mit derselben Regel.
 */
export interface ExpenseDraft {
  tripId: string;
  title: string;
  /** Der Gesamtbetrag in der kleinsten Einheit von `currency`. */
  originalAmountCents: number;
  currency: Currency;
  payerId: string;
  splitMode: SplitMode;
  /**
   * Die Beteiligten mit ihrem Anteil in der erfassten Waehrung. Bei
   * gleichmaessiger Aufteilung zaehlt nur, wer darin steht -- die Betraege
   * ergeben sich aus der Teilung (siehe split.ts).
   */
  shares: ExpenseShare[];
}

/** Warum eine Ausgabe nicht gespeichert wird. */
export type ExpenseProblem =
  | "titleMissing"
  | "titleTooLong"
  | "amountInvalid"
  | "noParticipants"
  | "shareInvalid"
  | "sharesMismatch";

/**
 * Warum ein Speicherversuch gescheitert ist -- die Pruefungen oben, dazu
 * die Gruende, die erst der Server kennt.
 */
export type ExpenseFailureReason =
  | ExpenseProblem
  | "notInTrip"
  | "rateUnavailable"
  | "unknown"
  | "failed";

export const EXPENSE_ERRORS: Record<ExpenseFailureReason, string> = {
  titleMissing: "Bitte einen Titel angeben.",
  titleTooLong: `Der Titel darf höchstens ${EXPENSE_TITLE_MAX} Zeichen lang sein.`,
  amountInvalid: "Bitte einen Betrag größer als null angeben.",
  noParticipants: "Bitte mindestens eine beteiligte Person auswählen.",
  shareInvalid: "Ein Anteil darf nicht negativ sein.",
  sharesMismatch: "Die Anteile ergeben nicht den Gesamtbetrag.",
  notInTrip: "Zahler und Beteiligte müssen Teilnehmer dieser Reise sein.",
  rateUnavailable:
    "Der Wechselkurs ist gerade nicht abrufbar — eine Ausgabe in fremder Währung wird ohne Kurs nicht gespeichert.",
  unknown: "Diese Ausgabe gibt es nicht mehr.",
  failed: "Das hat nicht geklappt. Bitte noch einmal versuchen.",
};

/**
 * Prueft eine erfasste Ausgabe (req-029) und nennt das erste Problem, oder
 * null, wenn sie gespeichert werden darf.
 */
export function validateExpenseDraft(
  draft: ExpenseDraft,
): ExpenseProblem | null {
  const title = draft.title.trim();
  if (title.length === 0) return "titleMissing";
  if (title.length > EXPENSE_TITLE_MAX) return "titleTooLong";

  if (!Number.isInteger(draft.originalAmountCents)) return "amountInvalid";
  if (draft.originalAmountCents <= 0) return "amountInvalid";

  if (draft.shares.length === 0) return "noParticipants";
  if (
    draft.shares.some(
      (share) => !Number.isInteger(share.amountCents) || share.amountCents < 0,
    )
  ) {
    return "shareInvalid";
  }
  // Eine Person ist an derselben Ausgabe hoechstens einmal beteiligt.
  const beteiligte = new Set(draft.shares.map((share) => share.participantId));
  if (beteiligte.size !== draft.shares.length) return "shareInvalid";

  // Nur bei individueller Aufteilung sind die Betraege verbindlich; bei
  // gleichmaessiger ergeben sie sich aus der Teilung und gehen immer auf.
  if (
    draft.splitMode === "individuell" &&
    shareDifference(draft.originalAmountCents, draft.shares) !== 0
  ) {
    return "sharesMismatch";
  }

  return null;
}
