"use client";

import { useState } from "react";
import {
  participantDisplayName,
  participantInitials,
} from "@/lib/participants/display-name";
import {
  formatEuro,
  formatMoney,
  formatSignedEuro,
} from "@/lib/expenses/money";
import { formatBeneficiaries, formatExpenseDate } from "@/lib/expenses/format";
import {
  balanceOf,
  computeBalances,
  totalExpenseCents,
} from "@/lib/expenses/balances";
import { settlePayments } from "@/lib/expenses/settlement";
import type { Expense, ExpensePerson } from "@/lib/expenses/types";
import { BalanceOverview } from "./balance-overview";
import { ExpenseSheet } from "./expense-sheet";
import { ExpenseDeleteDialog } from "./expense-delete-dialog";
import styles from "./costs-view.module.css";

/** Welche der beiden Ansichten der Umschalter zeigt (req-030). */
type CostsTab = "uebersicht" | "ausgaben";

/**
 * Der Bereich „Kosten“ des Begleiters (req-029 und req-030, Vorlage
 * Abschnitt „3. Kosten (Gruppenkasse)“): oben die Zusammenfassung, darunter
 * ein Umschalter zwischen der Übersicht mit Salden und Ausgleich und der
 * Liste aller Ausgaben.
 *
 * Erfassen, Aendern und Entfernen einer Ausgabe geschieht in der
 * Ausgabenliste; Salden und Ausgleich werden daraus gerechnet und nirgends
 * gespeichert (req-030, Constraints).
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
  const [tab, setTab] = useState<CostsTab>("uebersicht");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Salden und Ausgleich haengen allein an den Ausgaben -- sie werden bei
  // jeder Aenderung neu gerechnet, statt getrennt gefuehrt zu werden.
  const balances = computeBalances(
    expenses,
    tripPeople.map((person) => person.id),
  );
  const payments = settlePayments(balances);
  const eigenerSaldo = balanceOf(balances, selfParticipantId);

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
      <div className={styles.summary}>
        <div className={styles.summaryTop}>
          <span className={styles.summaryKind}>
            Gruppenkasse · {tripPeople.length}{" "}
            {tripPeople.length === 1 ? "Person" : "Personen"}
          </span>
          <span className={styles.summaryCount}>
            {expenses.length} {expenses.length === 1 ? "Ausgabe" : "Ausgaben"}
          </span>
        </div>
        <div className={styles.summaryBottom}>
          <span className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>Gesamt</span>
            <strong className={styles.summaryTotal} data-testid="costs-total">
              {formatEuro(totalExpenseCents(expenses))}
            </strong>
          </span>
          <span className={`${styles.summaryBlock} ${styles.summaryRight}`}>
            <span className={styles.summaryLabel}>Dein Saldo</span>
            <strong
              className={`${styles.summaryOwn} ${
                eigenerSaldo < 0 ? styles.owes : styles.gets
              }`}
              data-testid="costs-own-balance"
            >
              {formatSignedEuro(eigenerSaldo)}
            </strong>
          </span>
        </div>
      </div>

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

      <div className={styles.segments} role="group" aria-label="Ansicht">
        <button
          type="button"
          className={`${styles.segment} ${
            tab === "uebersicht" ? styles.segmentActive : ""
          }`}
          aria-pressed={tab === "uebersicht"}
          onClick={() => setTab("uebersicht")}
        >
          Übersicht
        </button>
        <button
          type="button"
          className={`${styles.segment} ${
            tab === "ausgaben" ? styles.segmentActive : ""
          }`}
          aria-pressed={tab === "ausgaben"}
          onClick={() => setTab("ausgaben")}
        >
          Alle Ausgaben ({expenses.length})
        </button>
      </div>

      {tab === "uebersicht" && (
        <BalanceOverview
          tripId={tripId}
          people={people}
          balances={balances}
          payments={payments}
          onSettled={onSaved}
        />
      )}

      {tab === "ausgaben" && (
        <section className={styles.panel} aria-label="Alle Ausgaben">
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
                    : formatMoney(
                        expense.originalAmountCents,
                        expense.currency,
                      ),
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
        </section>
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
