"use client";

import { useMemo, useState } from "react";
import { participantDisplayName } from "@/lib/participants/display-name";
import { parseAmountToCents } from "@/lib/expenses/money";
import {
  shareDifference,
  shareDifferenceText,
  toEuroShares,
} from "@/lib/expenses/split";
import { saveExpense, saveNewExpense } from "@/lib/expenses/save-expense";
import {
  CURRENCIES,
  isCurrency,
  type Currency,
  type Expense,
  type ExpensePerson,
  type ExpenseShare,
  type SplitMode,
} from "@/lib/expenses/types";
import {
  EXPENSE_ERRORS,
  EXPENSE_TITLE_MAX,
  validateExpenseDraft,
  type ExpenseDraft,
} from "@/lib/expenses/validate";
import styles from "./expense-sheet.module.css";

/** Wie die Waehrung in der Auswahl steht (Vorlage, Abschnitt „3. Kosten“). */
const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: "EUR €",
  CHF: "CHF",
  USD: "USD $",
  GBP: "GBP £",
};

const SPLIT_LABELS: Record<SplitMode, string> = {
  gleichmaessig: "Gleichmäßig",
  individuell: "Individuell",
};

/**
 * Die Anteile einer bestehenden Ausgabe zurueck in ihre erfasste Waehrung
 * gerechnet (req-029): gespeichert sind sie in Euro, eingetragen wurden sie
 * in der Waehrung der Ausgabe. Gerechnet wird mit dem gespeicherten Kurs --
 * ein neuer wuerde bereits abgerechnete Betraege verschieben.
 */
function sharesInOriginalCurrency(expense: Expense): ExpenseShare[] {
  if (expense.currency === "EUR") return expense.shares;
  return toEuroShares(
    expense.shares,
    1 / expense.exchangeRate,
    expense.originalAmountCents,
    expense.payerId,
  );
}

function centsToText(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

/**
 * Das Blatt „Neue Ausgabe“ des Begleiters (req-029, Vorlage Abschnitt „3.
 * Kosten“). Dasselbe Blatt aendert eine bereits erfasste Ausgabe -- dann
 * mit ihren Werten vorbelegt.
 *
 * Der Beleg-Scan der Vorlage entfaellt; dafuer gibt es den Umschalter
 * zwischen gleichmaessiger und individueller Aufteilung.
 */
export function ExpenseSheet({
  tripId,
  people,
  expense,
  defaultPayerId,
  onSaved,
  onClose,
}: {
  tripId: string;
  /** Die Teilnehmer dieser Reise -- nur sie zahlen und sind beteiligt. */
  people: ExpensePerson[];
  /** Die zu aendernde Ausgabe, oder undefined beim Erfassen. */
  expense?: Expense;
  defaultPayerId: string;
  onSaved: (expense: Expense) => void;
  onClose: () => void;
}) {
  const originalShares = useMemo(
    () => (expense ? sharesInOriginalCurrency(expense) : []),
    [expense],
  );

  const [title, setTitle] = useState(expense?.title ?? "");
  const [amountText, setAmountText] = useState(
    expense ? centsToText(expense.originalAmountCents) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    expense?.currency ?? "EUR",
  );
  const [payerId, setPayerId] = useState(expense?.payerId ?? defaultPayerId);
  const [splitMode, setSplitMode] = useState<SplitMode>(
    expense?.splitMode ?? "gleichmaessig",
  );
  // Beim Erfassen sind zunaechst alle Teilnehmer beteiligt -- und damit
  // auch der Zahler, der sich aber abwaehlen laesst (req-029).
  const [selected, setSelected] = useState<string[]>(
    expense
      ? originalShares.map((share) => share.participantId)
      : people.map((person) => person.id),
  );
  const [shareTexts, setShareTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      originalShares.map((share) => [
        share.participantId,
        centsToText(share.amountCents),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const amountCents = parseAmountToCents(amountText) ?? 0;
  const beteiligte = people.filter((person) => selected.includes(person.id));

  /** Die eingetragenen Anteile, in der Reihenfolge der Beteiligten. */
  const individualShares: ExpenseShare[] = beteiligte.map((person) => ({
    participantId: person.id,
    amountCents: parseAmountToCents(shareTexts[person.id] ?? "") ?? 0,
  }));

  const difference = shareDifference(amountCents, individualShares);

  function toggle(personId: string) {
    setNotice(null);
    setSelected((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );
  }

  function draftOf(): ExpenseDraft {
    return {
      tripId,
      title,
      originalAmountCents: amountCents,
      currency,
      payerId,
      splitMode,
      // Bei gleichmaessiger Aufteilung zaehlt nur, wer beteiligt ist --
      // die Betraege ergeben sich aus der Teilung (siehe lib/expenses).
      shares:
        splitMode === "gleichmaessig"
          ? beteiligte.map((person) => ({
              participantId: person.id,
              amountCents: 0,
            }))
          : individualShares,
    };
  }

  async function submit() {
    if (saving) return;
    setNotice(null);

    const draft = draftOf();
    const problem = validateExpenseDraft(draft);
    if (problem) {
      setNotice(
        problem === "sharesMismatch"
          ? `${EXPENSE_ERRORS.sharesMismatch} ${shareDifferenceText(difference, currency)}`
          : EXPENSE_ERRORS[problem],
      );
      return;
    }

    setSaving(true);
    const result = expense
      ? await saveExpense(expense.id, draft)
      : await saveNewExpense(draft);
    setSaving(false);

    if (!result.ok) {
      setNotice(EXPENSE_ERRORS[result.reason]);
      return;
    }
    onSaved(result.expense);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.frame}>
        <form
          className={styles.sheet}
          role="dialog"
          aria-label={expense ? "Ausgabe ändern" : "Neue Ausgabe"}
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h2 className={styles.title}>
            {expense ? "Ausgabe ändern" : "Neue Ausgabe"}
          </h2>

          <label className={styles.field}>
            <span className={styles.label}>Titel</span>
            <input
              className={styles.input}
              value={title}
              maxLength={EXPENSE_TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className={styles.amountRow}>
            <label className={`${styles.field} ${styles.amountField}`}>
              <span className={styles.label}>Betrag</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Währung</span>
              <select
                className={styles.input}
                value={currency}
                onChange={(event) => {
                  if (isCurrency(event.target.value)) {
                    setCurrency(event.target.value);
                  }
                }}
              >
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {CURRENCY_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Zahler</span>
            <select
              className={styles.input}
              value={payerId}
              onChange={(event) => setPayerId(event.target.value)}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {participantDisplayName(person)}
                </option>
              ))}
            </select>
          </label>

          <fieldset className={styles.group}>
            <legend className={styles.label}>Für wen wurde gezahlt?</legend>
            <div className={styles.chips}>
              {people.map((person) => {
                const aktiv = selected.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    className={`${styles.chip} ${aktiv ? styles.chipActive : ""}`}
                    aria-pressed={aktiv}
                    onClick={() => toggle(person.id)}
                  >
                    {participantDisplayName(person)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.label}>Aufteilung</legend>
            <div className={styles.segments}>
              {(["gleichmaessig", "individuell"] as SplitMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.segment} ${
                    splitMode === mode ? styles.segmentActive : ""
                  }`}
                  aria-pressed={splitMode === mode}
                  onClick={() => {
                    setNotice(null);
                    setSplitMode(mode);
                  }}
                >
                  {SPLIT_LABELS[mode]}
                </button>
              ))}
            </div>

            {splitMode === "gleichmaessig" ? (
              <p className={styles.hint}>
                Wird gleichmäßig auf {beteiligte.length}{" "}
                {beteiligte.length === 1 ? "Person" : "Personen"} aufgeteilt.
                Ein Rest von wenigen Cent bleibt beim Zahler.
              </p>
            ) : (
              <>
                <ul className={styles.shareList}>
                  {beteiligte.map((person) => (
                    <li key={person.id} className={styles.shareRow}>
                      <label className={styles.shareLabel}>
                        <span className={styles.shareName}>
                          {participantDisplayName(person)}
                        </span>
                        <input
                          className={`${styles.input} ${styles.shareInput}`}
                          inputMode="decimal"
                          aria-label={`Anteil: ${participantDisplayName(person)}`}
                          value={shareTexts[person.id] ?? ""}
                          onChange={(event) => {
                            const wert = event.target.value;
                            setNotice(null);
                            setShareTexts((prev) => ({
                              ...prev,
                              [person.id]: wert,
                            }));
                          }}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
                <p className={styles.hint} data-testid="expense-difference">
                  {shareDifferenceText(difference, currency)}
                </p>
              </>
            )}
          </fieldset>

          {notice && (
            <p
              className={styles.error}
              role="alert"
              data-testid="expense-error"
            >
              {notice}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saving}
            >
              {expense ? "Speichern" : "Hinzufügen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
