import { describe, expect, it } from "vitest";
import {
  equalShares,
  shareDifference,
  shareDifferenceText,
  sumShares,
  toEuroShares,
} from "./split";

const ANNA = "anna";
const BEN = "ben";
const CLARA = "clara";
const ALLE = [ANNA, BEN, CLARA];

describe("equalShares (req-029)", () => {
  it("teilt einen aufgehenden Betrag gleichmaessig", () => {
    expect(equalShares(6000, ALLE, ANNA)).toEqual([
      { participantId: ANNA, amountCents: 2000 },
      { participantId: BEN, amountCents: 2000 },
      { participantId: CLARA, amountCents: 2000 },
    ]);
  });

  it("laesst den Rest beim Zahler und trifft die Summe genau", () => {
    const shares = equalShares(1000, ALLE, BEN);

    expect(shares).toEqual([
      { participantId: ANNA, amountCents: 333 },
      { participantId: BEN, amountCents: 334 },
      { participantId: CLARA, amountCents: 333 },
    ]);
    expect(sumShares(shares)).toBe(1000);
  });

  it("gibt dem nicht beteiligten Zahler keinen Anteil", () => {
    const shares = equalShares(1000, [BEN, CLARA], ANNA);

    expect(shares.map((share) => share.participantId)).toEqual([BEN, CLARA]);
    expect(sumShares(shares)).toBe(1000);
  });

  it("legt den Rest beim ersten Beteiligten ab, wenn der Zahler aussen vor ist", () => {
    expect(equalShares(1000, [BEN, CLARA, "dora"], ANNA)).toEqual([
      { participantId: BEN, amountCents: 334 },
      { participantId: CLARA, amountCents: 333 },
      { participantId: "dora", amountCents: 333 },
    ]);
  });

  it("liefert ohne Beteiligte keine Anteile", () => {
    expect(equalShares(1000, [], ANNA)).toEqual([]);
  });
});

describe("toEuroShares (req-029)", () => {
  it("laesst Euro-Anteile unveraendert", () => {
    const shares = [
      { participantId: ANNA, amountCents: 2000 },
      { participantId: BEN, amountCents: 4000 },
    ];

    expect(toEuroShares(shares, 1, 6000, ANNA)).toEqual(shares);
  });

  it("rechnet um und legt den Rundungsrest beim Zahler ab", () => {
    // Jeder Anteil rundet einzeln auf 100 Cent ab; zusammen waeren das 300
    // statt der 302 Cent des Gesamtbetrags. Die fehlenden 2 Cent traegt
    // der Zahler.
    const shares = toEuroShares(
      [
        { participantId: ANNA, amountCents: 100 },
        { participantId: BEN, amountCents: 100 },
        { participantId: CLARA, amountCents: 100 },
      ],
      1.005,
      302,
      BEN,
    );

    expect(shares).toEqual([
      { participantId: ANNA, amountCents: 100 },
      { participantId: BEN, amountCents: 102 },
      { participantId: CLARA, amountCents: 100 },
    ]);
    expect(sumShares(shares)).toBe(302);
  });

  it("liefert ohne Anteile nichts", () => {
    expect(toEuroShares([], 1.06, 10600, ANNA)).toEqual([]);
  });
});

describe("Abweichung zum Gesamtbetrag (req-029)", () => {
  it("nennt, was noch fehlt", () => {
    const shares = [
      { participantId: ANNA, amountCents: 2000 },
      { participantId: BEN, amountCents: 2000 },
      { participantId: CLARA, amountCents: 1500 },
    ];

    expect(shareDifference(6000, shares)).toBe(500);
    expect(shareDifferenceText(500, "EUR")).toBe("Es fehlen noch 5,00 €.");
  });

  it("nennt, was zu viel ist", () => {
    expect(shareDifferenceText(-250, "CHF")).toBe("2,50 CHF zu viel.");
  });

  it("bestaetigt den Gleichstand", () => {
    expect(shareDifferenceText(0, "EUR")).toBe(
      "Die Anteile ergeben den Gesamtbetrag.",
    );
  });
});
