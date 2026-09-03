import { describe, expect, it } from "vitest";
import { toEuroAmounts } from "./build";
import { sumShares } from "./split";
import type { ExpenseDraft } from "./validate";

const ANNA = "anna";
const BEN = "ben";
const CLARA = "clara";

const DREI: ExpenseDraft = {
  tripId: "trip-1",
  title: "Abendessen",
  originalAmountCents: 6000,
  currency: "EUR",
  payerId: ANNA,
  splitMode: "gleichmaessig",
  shares: [
    { participantId: ANNA, amountCents: 0 },
    { participantId: BEN, amountCents: 0 },
    { participantId: CLARA, amountCents: 0 },
  ],
};

describe("toEuroAmounts (req-029)", () => {
  it("teilt gleichmaessig und beachtet die eingetragenen Betraege nicht", () => {
    const { amountCents, shares } = toEuroAmounts(DREI, 1);

    expect(amountCents).toBe(6000);
    expect(shares).toEqual([
      { participantId: ANNA, amountCents: 2000 },
      { participantId: BEN, amountCents: 2000 },
      { participantId: CLARA, amountCents: 2000 },
    ]);
  });

  it("trifft bei nicht aufgehender Teilung die Summe genau", () => {
    const { shares } = toEuroAmounts({ ...DREI, originalAmountCents: 1000 }, 1);

    expect(sumShares(shares)).toBe(1000);
  });

  it("rechnet einen Betrag in fremder Waehrung in Euro um", () => {
    const { amountCents, shares } = toEuroAmounts(
      { ...DREI, originalAmountCents: 9500, currency: "CHF" },
      1.06,
    );

    expect(amountCents).toBe(10070);
    expect(sumShares(shares)).toBe(10070);
  });

  it("uebernimmt bei individueller Aufteilung die eingetragenen Betraege", () => {
    const { shares } = toEuroAmounts(
      {
        ...DREI,
        splitMode: "individuell",
        shares: [
          { participantId: ANNA, amountCents: 2500 },
          { participantId: BEN, amountCents: 2000 },
          { participantId: CLARA, amountCents: 1500 },
        ],
      },
      1,
    );

    expect(shares).toEqual([
      { participantId: ANNA, amountCents: 2500 },
      { participantId: BEN, amountCents: 2000 },
      { participantId: CLARA, amountCents: 1500 },
    ]);
  });
});
