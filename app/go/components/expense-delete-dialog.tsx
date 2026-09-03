"use client";

import { useState } from "react";
import { formatEuro } from "@/lib/expenses/money";
import { removeExpense } from "@/lib/expenses/save-expense";
import { EXPENSE_ERRORS } from "@/lib/expenses/validate";
import type { Expense } from "@/lib/expenses/types";
import styles from "./expense-delete-dialog.module.css";

/**
 * Die Rueckfrage, bevor eine Ausgabe entfernt wird (req-029). Sie nennt
 * Titel und Betrag -- erst nach Bestaetigung wird entfernt.
 */
export function ExpenseDeleteDialog({
  expense,
  onRemoved,
  onCancel,
}: {
  expense: Expense;
  onRemoved: (expense: Expense) => void;
  onCancel: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function confirm() {
    if (removing) return;
    setRemoving(true);
    setFailed(null);

    const result = await removeExpense(expense.id);
    setRemoving(false);
    if (!result.ok) {
      setFailed(EXPENSE_ERRORS[result.reason]);
      return;
    }
    onRemoved(expense);
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Ausgabe entfernen"
      >
        <h2 className={styles.title}>Ausgabe entfernen</h2>
        <p className={styles.text}>
          „{expense.title}“ über {formatEuro(expense.amountCents)} wird aus der
          Gruppenkasse entfernt.
        </p>
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="expense-remove-error"
          >
            {failed}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => void confirm()}
            disabled={removing}
          >
            {removing ? "Entfernt…" : "Entfernen"}
          </button>
        </div>
      </div>
    </div>
  );
}
