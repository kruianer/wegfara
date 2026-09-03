import { describe, expect, it } from "vitest";
import type { Balance } from "./balances";
import { settlementDraft, settlementTitle, settlePayments } from "./settlement";
import { validateExpenseDraft } from "./validate";

const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

/** Ein Saldo -- ausgelegt und Anteil spielen fuer den Ausgleich keine Rolle. */
function saldo(participantId: string, balanceCents: number): Balance {
  return {
    participantId,
    paidCents: Math.max(balanceCents, 0),
    shareCents: Math.max(-balanceCents, 0),
    balanceCents,
  };
}

/** Die Salden, nachdem die Zahlungen geflossen sind. */
function nachAusgleich(balances: Balance[]): Map<string, number> {
  const offen = new Map(
    balances.map((balance) => [balance.participantId, balance.balanceCents]),
  );
  for (const payment of settlePayments(balances)) {
    offen.set(
      payment.fromId,
      (offen.get(payment.fromId) ?? 0) + payment.amountCents,
    );
    offen.set(
      payment.toId,
      (offen.get(payment.toId) ?? 0) - payment.amountCents,
    );
  }
  return offen;
}

describe("Ausgleich (req-030)", () => {
  it("gleicht drei Personen mit einer Ausgabe ueber zwei Zahlungen aus", () => {
    const payments = settlePayments([
      saldo("uwe", 4000),
      saldo("ben", -2000),
      saldo("clara", -2000),
    ]);

    expect(payments).toHaveLength(2);
    expect(payments).toEqual([
      { fromId: "ben", toId: "uwe", amountCents: 2000 },
      { fromId: "clara", toId: "uwe", amountCents: 2000 },
    ]);
  });

  it("braucht bei sechs Personen hoechstens fuenf Zahlungen", () => {
    const balances = [
      saldo("a", 12345),
      saldo("b", -4321),
      saldo("c", 876),
      saldo("d", -9000),
      saldo("e", 1100),
      saldo("f", -1000),
    ];

    expect(settlePayments(balances).length).toBeLessThanOrEqual(5);
  });

  it("bringt alle Salden auf null", () => {
    const balances = [
      saldo("a", 12345),
      saldo("b", -4321),
      saldo("c", 876),
      saldo("d", -9000),
      saldo("e", 1100),
      saldo("f", -1000),
    ];

    for (const rest of nachAusgleich(balances).values()) {
      expect(rest).toBe(0);
    }
  });

  it("schlaegt bei ausgeglichenen Salden keine Zahlung vor", () => {
    expect(
      settlePayments([saldo("uwe", 0), saldo("ben", 0), saldo("clara", 0)]),
    ).toEqual([]);
  });

  it("kommt ohne Salden ohne Zahlung aus", () => {
    expect(settlePayments([])).toEqual([]);
  });

  it("gleicht zwei Personen mit einer einzigen Zahlung aus", () => {
    expect(settlePayments([saldo("uwe", 2000), saldo("clara", -2000)])).toEqual(
      [{ fromId: "clara", toId: "uwe", amountCents: 2000 }],
    );
  });

  it("laesst den groessten Schuldner an den groessten Glaeubiger zahlen", () => {
    const payments = settlePayments([
      saldo("klein", 1000),
      saldo("gross", 5000),
      saldo("schuldner", -6000),
    ]);

    expect(payments[0]).toEqual({
      fromId: "schuldner",
      toId: "gross",
      amountCents: 5000,
    });
  });
});

describe("Abgehakte Zahlung als Ausgabe (req-030)", () => {
  const ZAHLUNG = { fromId: "clara", toId: "uwe", amountCents: 2000 };

  it("macht den Zahlenden zum Zahler und allein den Empfaenger beteiligt", () => {
    const draft = settlementDraft(TRIP_ID, ZAHLUNG, "Uwe Kremmel");

    expect(draft).toMatchObject({
      tripId: TRIP_ID,
      originalAmountCents: 2000,
      currency: "EUR",
      payerId: "clara",
    });
    expect(draft.shares).toEqual([{ participantId: "uwe", amountCents: 2000 }]);
  });

  it("ergibt eine Ausgabe, die die Pruefung besteht", () => {
    expect(
      validateExpenseDraft(settlementDraft(TRIP_ID, ZAHLUNG, "Uwe Kremmel")),
    ).toBeNull();
  });

  it("benennt die Ausgabe nach dem Empfaenger", () => {
    expect(settlementTitle("Uwe Kremmel")).toBe("Rückzahlung an Uwe Kremmel");
  });

  it("kuerzt einen zu langen Titel, statt das Abhaken scheitern zu lassen", () => {
    const titel = settlementTitle("A".repeat(80));

    expect(titel).toHaveLength(80);
    expect(
      validateExpenseDraft(settlementDraft(TRIP_ID, ZAHLUNG, "A".repeat(80))),
    ).toBeNull();
  });
});
