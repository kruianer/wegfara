import type { Balance } from "./balances";
import { EXPENSE_TITLE_MAX, type ExpenseDraft } from "./validate";

/**
 * Eine vorgeschlagene Zahlung des Ausgleichs (req-030) -- „Clara zahlt Uwe
 * 40,00 €“. Betraege sind Euro-Cent; Euro ist die Waehrung der Abrechnung.
 */
export interface SettlementPayment {
  /** Wer zahlt: die Person mit negativem Saldo. */
  fromId: string;
  /** Wer bekommt: die Person mit positivem Saldo. */
  toId: string;
  amountCents: number;
}

/** Ein Posten des Ausgleichs mit dem, was von seinem Saldo noch offen ist. */
interface Offen {
  id: string;
  offen: number;
}

/** Absteigend nach offenem Betrag; bei Gleichstand bleibt die Reihenfolge. */
function groessteZuerst(posten: Offen[]): Offen[] {
  return [...posten].sort((a, b) => b.offen - a.offen);
}

/**
 * Der Ausgleich (req-030): konkrete Zahlungen, die alle Salden auf null
 * bringen -- mit moeglichst wenigen.
 *
 * Gerechnet wird nach dem Greedy-Verfahren der Vorlage (Abschnitt „3.
 * Kosten“): der groesste Schuldner zahlt an den groessten Glaeubiger, bis
 * einer von beiden bei null steht. Jede Zahlung gleicht damit mindestens
 * eine Person vollstaendig aus, sodass bei n Personen hoechstens n-1
 * Zahlungen bleiben -- bei sechs Personen fuenf statt der fuenfzehn, die
 * jeder-mit-jedem ergaebe.
 */
export function settlePayments(balances: Balance[]): SettlementPayment[] {
  const schuldner = groessteZuerst(
    balances
      .filter((balance) => balance.balanceCents < 0)
      .map((balance) => ({
        id: balance.participantId,
        offen: -balance.balanceCents,
      })),
  );
  const glaeubiger = groessteZuerst(
    balances
      .filter((balance) => balance.balanceCents > 0)
      .map((balance) => ({
        id: balance.participantId,
        offen: balance.balanceCents,
      })),
  );

  const payments: SettlementPayment[] = [];
  let i = 0;
  let j = 0;
  while (i < schuldner.length && j < glaeubiger.length) {
    const betrag = Math.min(schuldner[i].offen, glaeubiger[j].offen);
    payments.push({
      fromId: schuldner[i].id,
      toId: glaeubiger[j].id,
      amountCents: betrag,
    });
    schuldner[i].offen -= betrag;
    glaeubiger[j].offen -= betrag;
    if (schuldner[i].offen === 0) i += 1;
    if (glaeubiger[j].offen === 0) j += 1;
  }
  return payments;
}

/** Eine Zahlung eindeutig benennen -- fuer Listen und Zustaende. */
export function paymentKey(payment: SettlementPayment): string {
  return `${payment.fromId}->${payment.toId}`;
}

/**
 * Wie eine abgehakte Zahlung in der Ausgabenliste heisst (req-030). Der
 * Titel einer Ausgabe ist begrenzt (req-029) -- ein langer Name wird
 * gekuerzt, statt das Abhaken scheitern zu lassen.
 */
export function settlementTitle(recipientName: string): string {
  return `Rückzahlung an ${recipientName}`.slice(0, EXPENSE_TITLE_MAX);
}

/**
 * Die abgehakte Zahlung als gewoehnliche Ausgabe (req-030, Constraints):
 * Zahler ist der Zahlende, beteiligt ist allein der Empfaenger. Eine zweite
 * Ablage fuer Zahlungen zwischen Teilnehmern gibt es bewusst nicht -- so
 * laesst sich die Zahlung ueber die Ausgabenliste wieder entfernen, und der
 * Vorschlag taucht dadurch von selbst wieder auf.
 */
export function settlementDraft(
  tripId: string,
  payment: SettlementPayment,
  recipientName: string,
): ExpenseDraft {
  return {
    tripId,
    title: settlementTitle(recipientName),
    originalAmountCents: payment.amountCents,
    currency: "EUR",
    payerId: payment.fromId,
    splitMode: "gleichmaessig",
    shares: [{ participantId: payment.toId, amountCents: payment.amountCents }],
  };
}
