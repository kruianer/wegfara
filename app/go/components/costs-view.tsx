"use client";

import { useState } from "react";
import {
  participantDisplayName,
  participantInitials,
} from "@/lib/participants/display-name";
import { formatEuro, formatMoney } from "@/lib/expenses/money";
import { formatBeneficiaries, formatExpenseDate } from "@/lib/expenses/format";
import type { Expense, ExpensePerson } from "@/lib/expenses/types";
import { ExpenseSheet } from "./expense-sheet";
import { ExpenseDeleteDialog } from "./expense-delete-dialog";
import styles from "./costs-view.module.css";

/**
 * Der Bereich „Kosten“ des Begleiters (req-029, Vorlage Abschnitt „3.
 * Kosten (Gruppenkasse)“). Er zeigt die Ausgaben der geoeffneten Reise, die
 * neueste zuerst, und laesst jeden Teilnehmer eine Ausgabe erfassen,
 * aendern und entfernen.
 *
 * Die Zusammenfassung, der Umschalter „Übersicht | Alle Ausgaben“ und die
 * Salden der Vorlage sind nicht Teil dieses Requirements.
 */
export function CostsView({
  tripId,
  people,
  tripPeople,
  expenses,
  selfParticipantId,
  onSaved,
  onRemoved,
}: {
  tripId: string;
  /** Alle Personen des Accounts -- zum Benennen auch fruehrer Beteiligter. */
  people: ExpensePerson[];
  /** Die Teilnehmer dieser Reise -- nur sie zahlen und sind beteiligt. */
  tripPeople: ExpensePerson[];
  /** Die Ausgaben dieser Reise, die neueste zuerst. */
  expenses: Expense[];
  selfParticipantId: string;
  onSaved: (expense: Expense) => void;
  onRemoved: (expense: Expense) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function nameOf(participantId: string): string {
    const person = people.find((candidate) => candidate.id === participantId);
    return person ? participantDisplayName(person) : "Unbekannt";
  }

  /** Vorbelegt ist, wer erfasst -- sofern er bei dieser Reise mitfaehrt. */
  const defaultPayerId = tripPeople.some(
    (person) => person.id === selfParticipantId,
  )
    ? selfParticipantId
    : (tripPeople[0]?.id ?? "");

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  return (
    <section className={styles.section} aria-label="Kosten">
      <button
        type="button"
        className={styles.addButton}
        disabled={tripPeople.length === 0}
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
      >
        + Neue Ausgabe erfassen
      </button>

      {tripPeople.length === 0 && (
        <p className={styles.empty}>
          Für diese Reise ist noch niemand eingeteilt.
        </p>
      )}

      <h2 className={styles.heading}>Alle Ausgaben</h2>

      {expenses.length === 0 ? (
        <p className={styles.empty}>Noch keine Ausgaben erfasst</p>
      ) : (
        <ul className={styles.list}>
          {expenses.map((expense) => {
            const offen = expanded === expense.id;
            const meta = [
              nameOf(expense.payerId),
              formatBeneficiaries(expense.shares.length, tripPeople.length),
              formatExpenseDate(expense.createdAt),
              // Der urspruengliche Betrag samt Waehrung bleibt sichtbar
              // (req-029).
              expense.currency === "EUR"
                ? null
                : formatMoney(expense.originalAmountCents, expense.currency),
            ]
              .filter((teil) => teil !== null)
              .join(" · ");

            return (
              <li key={expense.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.row}
                  aria-expanded={offen}
                  onClick={() => setExpanded(offen ? null : expense.id)}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {participantInitials(nameOf(expense.payerId))}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>{expense.title}</span>
                    <span className={styles.rowMeta}>{meta}</span>
                  </span>
                  <span className={styles.rowAmount}>
                    {formatEuro(expense.amountCents)}
                  </span>
                </button>

                {offen && (
                  <div className={styles.details}>
                    <ul className={styles.shareList} aria-label="Anteile">
                      {expense.shares.map((share) => (
                        <li
                          key={share.participantId}
                          className={styles.shareRow}
                        >
                          <span>{nameOf(share.participantId)}</span>
                          <span className={styles.shareAmount}>
                            {formatEuro(share.amountCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className={styles.detailActions}>
                      <button
                        type="button"
                        className={styles.detailButton}
                        onClick={() => {
                          setEditing(expense);
                          setSheetOpen(true);
                        }}
                      >
                        Ändern
                      </button>
                      <button
                        type="button"
                        className={`${styles.detailButton} ${styles.danger}`}
                        onClick={() => setRemoving(expense)}
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sheetOpen && tripPeople.length > 0 && (
        <ExpenseSheet
          key={editing?.id ?? "neu"}
          tripId={tripId}
          people={tripPeople}
          expense={editing ?? undefined}
          defaultPayerId={defaultPayerId}
          onSaved={(expense) => {
            onSaved(expense);
            closeSheet();
          }}
          onClose={closeSheet}
        />
      )}

      {removing && (
        <ExpenseDeleteDialog
          expense={removing}
          onRemoved={(expense) => {
            onRemoved(expense);
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
