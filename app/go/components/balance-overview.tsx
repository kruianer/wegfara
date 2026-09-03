"use client";

import { useState } from "react";
import {
  participantDisplayName,
  participantInitials,
  participantPaymentName,
} from "@/lib/participants/display-name";
import { formatEuro, formatSignedEuro } from "@/lib/expenses/money";
import type { Balance } from "@/lib/expenses/balances";
import {
  paymentKey,
  settlementDraft,
  type SettlementPayment,
} from "@/lib/expenses/settlement";
import { saveNewExpense } from "@/lib/expenses/save-expense";
import { EXPENSE_ERRORS } from "@/lib/expenses/validate";
import type { Expense, ExpensePerson } from "@/lib/expenses/types";
import styles from "./balance-overview.module.css";

/**
 * Die Übersicht des Bereichs „Kosten“ (req-030, Vorlage Abschnitt „3.
 * Kosten (Gruppenkasse)“): die Salden je Teilnehmer und darunter der
 * Ausgleich -- die Zahlungen, die alle Salden auf null bringen.
 *
 * Beide werden aus den Ausgaben gerechnet und nirgends gespeichert. Eine
 * abgehakte Zahlung wird als gewoehnliche Ausgabe erfasst; damit gleicht
 * sich der Saldo aus und der Vorschlag verschwindet von selbst.
 */
export function BalanceOverview({
  tripId,
  people,
  balances,
  payments,
  onSettled,
}: {
  tripId: string;
  /** Alle Personen des Accounts -- zum Benennen auch frueherer Beteiligter. */
  people: ExpensePerson[];
  /** Die Salden je Teilnehmer, in der Reihenfolge der Teilnehmerliste. */
  balances: Balance[];
  /** Die vorgeschlagenen Zahlungen des Ausgleichs. */
  payments: SettlementPayment[];
  /** Die aus einer abgehakten Zahlung entstandene Ausgabe. */
  onSettled: (expense: Expense) => void;
}) {
  const [settling, setSettling] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function personOf(participantId: string): ExpensePerson | undefined {
    return people.find((candidate) => candidate.id === participantId);
  }

  /** Wie eine Person in der Salden-Liste steht: Nickname vor Name (req-020). */
  function nameOf(participantId: string): string {
    const person = personOf(participantId);
    return person ? participantDisplayName(person) : "Unbekannt";
  }

  /**
   * Wie eine Person im Ausgleich steht: immer der volle Name, denn dort
   * steht eine Zahlung (req-020).
   */
  function paymentNameOf(participantId: string): string {
    const person = personOf(participantId);
    return person ? participantPaymentName(person) : "Unbekannt";
  }

  function satzZu(payment: SettlementPayment): string {
    return `${paymentNameOf(payment.fromId)} zahlt ${paymentNameOf(payment.toId)} ${formatEuro(payment.amountCents)}`;
  }

  // Der laengste Balken gehoert dem groessten Saldo; ohne Ausgaben bleiben
  // alle Balken leer, statt durch null zu teilen.
  const groesster = Math.max(
    1,
    ...balances.map((balance) => Math.abs(balance.balanceCents)),
  );

  async function settle(payment: SettlementPayment) {
    if (settling) return;
    setSettling(paymentKey(payment));
    setNotice(null);

    const result = await saveNewExpense(
      settlementDraft(tripId, payment, paymentNameOf(payment.toId)),
    );
    setSettling(null);

    if (!result.ok) {
      setNotice(EXPENSE_ERRORS[result.reason]);
      return;
    }
    onSettled(result.expense);
  }

  return (
    <section className={styles.panel} aria-label="Übersicht">
      <h2 className={styles.heading}>Salden</h2>

      <ul className={styles.balanceList} aria-label="Salden">
        {balances.map((balance) => {
          const bekommt = balance.balanceCents > 0;
          const anteil = (50 * Math.abs(balance.balanceCents)) / groesster || 0;
          return (
            <li key={balance.participantId} className={styles.balanceRow}>
              <span className={styles.avatar} aria-hidden="true">
                {participantInitials(nameOf(balance.participantId))}
              </span>
              <span className={styles.rowBody}>
                <span className={styles.name}>
                  {nameOf(balance.participantId)}
                </span>
                <span className={styles.meta}>
                  ausgelegt {formatEuro(balance.paidCents)} · entfällt{" "}
                  {formatEuro(balance.shareCents)}
                </span>
              </span>
              <span
                className={`${styles.amount} ${
                  balance.balanceCents === 0
                    ? styles.even
                    : bekommt
                      ? styles.gets
                      : styles.owes
                }`}
              >
                {formatSignedEuro(balance.balanceCents)}
              </span>
              <span className={styles.bar} aria-hidden="true">
                <span
                  className={`${styles.barFill} ${
                    bekommt ? styles.barGets : styles.barOwes
                  }`}
                  style={{ width: `${anteil}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>

      <h2 className={styles.heading}>Ausgleich</h2>

      {payments.length === 0 ? (
        <p className={styles.settled}>Alle Salden ausgeglichen</p>
      ) : (
        <ul className={styles.settleList} aria-label="Ausgleich">
          {payments.map((payment) => {
            const satz = satzZu(payment);
            const laeuft = settling === paymentKey(payment);
            return (
              <li key={paymentKey(payment)} className={styles.settleRow}>
                <span className={styles.settleText}>
                  {paymentNameOf(payment.fromId)} zahlt{" "}
                  {paymentNameOf(payment.toId)}
                </span>
                <span className={styles.settleAmount}>
                  {formatEuro(payment.amountCents)}
                </span>
                <button
                  type="button"
                  className={styles.settleButton}
                  aria-label={`Erledigt: ${satz}`}
                  disabled={settling !== null}
                  onClick={() => void settle(payment)}
                >
                  {laeuft ? "…" : "Erledigt"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {notice && (
        <p className={styles.error} role="alert" data-testid="settle-error">
          {notice}
        </p>
      )}
    </section>
  );
}
