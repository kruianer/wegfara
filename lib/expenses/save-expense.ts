import type { Expense } from "./types";
import type { ExpenseDraft, ExpenseFailureReason } from "./validate";
import { EXPENSE_ERRORS } from "./validate";

const EXPENSES_API = "/api/ausgaben";

export type ExpenseSaveResult =
  | { ok: true; expense: Expense }
  | { ok: false; reason: ExpenseFailureReason };

function isFailureReason(value: unknown): value is ExpenseFailureReason {
  return typeof value === "string" && value in EXPENSE_ERRORS;
}

/**
 * Der Grund, den der Server genannt hat -- oder `failed`, wenn er keinen
 * bekannten genannt hat oder gar nicht antwortete.
 */
async function reasonOf(response: Response): Promise<ExpenseFailureReason> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (isFailureReason(payload.error)) return payload.error;
  } catch {
    return "failed";
  }
  return "failed";
}

/**
 * Schickt die erfasste Ausgabe an den Server (req-029). Erfassen, Aendern
 * und Entfernen sind Vorgaenge, bei denen der Nutzer eine Bestaetigung
 * erwartet -- sie werden sofort geschrieben, nicht verzoegert (siehe
 * delivery/stack.md, Conventions).
 */
async function sendExpense(
  method: "POST" | "PUT",
  body: unknown,
): Promise<ExpenseSaveResult> {
  let response: Response;
  try {
    response = await fetch(EXPENSES_API, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  if (!response.ok) return { ok: false, reason: await reasonOf(response) };

  try {
    const payload = (await response.json()) as { expense?: Expense };
    if (payload.expense) return { ok: true, expense: payload.expense };
  } catch {
    return { ok: false, reason: "failed" };
  }
  return { ok: false, reason: "failed" };
}

/** Erfasst eine neue Ausgabe. */
export function saveNewExpense(
  draft: ExpenseDraft,
): Promise<ExpenseSaveResult> {
  return sendExpense("POST", draft);
}

/** Aendert eine erfasste Ausgabe. */
export function saveExpense(
  id: string,
  draft: ExpenseDraft,
): Promise<ExpenseSaveResult> {
  return sendExpense("PUT", { id, ...draft });
}

/** Entfernt eine Ausgabe -- erst nach der Rueckfrage (req-029). */
export async function removeExpense(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: ExpenseFailureReason }> {
  let response: Response;
  try {
    response = await fetch(EXPENSES_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  if (response.ok) return { ok: true };
  return { ok: false, reason: await reasonOf(response) };
}
