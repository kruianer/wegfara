import { describe, expect, it } from "vitest";
import { balanceOf, computeBalances, totalExpenseCents } from "./balances";
import type { Expense, ExpenseShare } from "./types";

const UWE = "5e0cd230-3765-425b-be49-6a95028ba0b8";
const BEN = "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111";
const CLARA = "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f2222";
const ALLE = [UWE, BEN, CLARA];

let laufendeNummer = 0;

/** Eine Ausgabe, wie sie aus der Datenbank kommt -- nur das Noetige. */
function ausgabe(
  amountCents: number,
  payerId: string,
  shares: ExpenseShare[],
): Expense {
  laufendeNummer += 1;
  return {
    id: `1a2b3c4d-0000-4000-8000-${String(laufendeNummer).padStart(12, "0")}`,
    tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
    title: "Abendessen",
    amountCents,
    originalAmountCents: amountCents,
    currency: "EUR",
    exchangeRate: 1,
    payerId,
    splitMode: "gleichmaessig",
    shares,
    createdAt: "2026-07-20T18:00:00.000Z",
  };
}

/** 60,00 € von Uwe gezahlt, gleichmaessig auf alle drei aufgeteilt. */
const ABENDESSEN = ausgabe(6000, UWE, [
  { participantId: UWE, amountCents: 2000 },
  { participantId: BEN, amountCents: 2000 },
  { participantId: CLARA, amountCents: 2000 },
]);

describe("Salden (req-030)", () => {
  it("gibt dem Zahler einer Ausgabe fuer drei den Saldo seines Vorschusses", () => {
    const balances = computeBalances([ABENDESSEN], ALLE);

    expect(balanceOf(balances, UWE)).toBe(4000);
  });

  it("belastet die beiden anderen Personen mit ihrem Anteil", () => {
    const balances = computeBalances([ABENDESSEN], ALLE);

    expect(balanceOf(balances, BEN)).toBe(-2000);
    expect(balanceOf(balances, CLARA)).toBe(-2000);
  });

  it("weist je Person aus, was sie ausgelegt hat und was auf sie entfaellt", () => {
    const [uwe, ben] = computeBalances([ABENDESSEN], ALLE);

    expect(uwe).toMatchObject({ paidCents: 6000, shareCents: 2000 });
    expect(ben).toMatchObject({ paidCents: 0, shareCents: 2000 });
  });

  it("ergibt in der Summe aller Salden null", () => {
    const balances = computeBalances(
      [
        ABENDESSEN,
        ausgabe(3333, BEN, [
          { participantId: BEN, amountCents: 1111 },
          { participantId: CLARA, amountCents: 2222 },
        ]),
        ausgabe(1000, CLARA, [{ participantId: UWE, amountCents: 1000 }]),
      ],
      ALLE,
    );

    const summe = balances.reduce(
      (gesamt, balance) => gesamt + balance.balanceCents,
      0,
    );
    expect(summe).toBe(0);
  });

  it("gibt ohne Ausgaben jedem Teilnehmer einen Saldo von null", () => {
    const balances = computeBalances([], ALLE);

    expect(balances).toHaveLength(3);
    expect(balances.every((balance) => balance.balanceCents === 0)).toBe(true);
  });

  it("haelt die Reihenfolge der uebergebenen Teilnehmer ein", () => {
    const balances = computeBalances([ABENDESSEN], ALLE);

    expect(balances.map((balance) => balance.participantId)).toEqual(ALLE);
  });

  it("haengt an, wer in Ausgaben vorkommt, aber nicht mehr mitfaehrt", () => {
    // Sonst verschwaende sein Saldo und die Summe ergaebe nicht null.
    const balances = computeBalances([ABENDESSEN], [UWE, BEN]);

    expect(balances.map((balance) => balance.participantId)).toEqual([
      UWE,
      BEN,
      CLARA,
    ]);
    expect(
      balances.reduce((summe, balance) => summe + balance.balanceCents, 0),
    ).toBe(0);
  });

  it("laesst den nicht beteiligten Zahler nur auslegen", () => {
    const balances = computeBalances(
      [
        ausgabe(6000, UWE, [
          { participantId: BEN, amountCents: 3000 },
          { participantId: CLARA, amountCents: 3000 },
        ]),
      ],
      ALLE,
    );

    expect(balanceOf(balances, UWE)).toBe(6000);
  });

  it("kennt den Saldo einer Person ohne jede Ausgabe nicht anders als null", () => {
    expect(balanceOf(computeBalances([], ALLE), "fremde-kennung")).toBe(0);
  });
});

describe("Gesamtsumme (req-030)", () => {
  it("zaehlt die Betraege aller Ausgaben zusammen", () => {
    expect(
      totalExpenseCents([
        ABENDESSEN,
        ausgabe(1050, BEN, [{ participantId: BEN, amountCents: 1050 }]),
      ]),
    ).toBe(7050);
  });

  it("ist ohne Ausgaben null", () => {
    expect(totalExpenseCents([])).toBe(0);
  });
});
