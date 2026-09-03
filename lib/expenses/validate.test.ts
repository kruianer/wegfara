import { describe, expect, it } from "vitest";
import {
  EXPENSE_TITLE_MAX,
  validateExpenseDraft,
  type ExpenseDraft,
} from "./validate";

const ANNA = "anna";
const BEN = "ben";
const CLARA = "clara";

const ABENDESSEN: ExpenseDraft = {
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

describe("validateExpenseDraft (req-029)", () => {
  it("laesst eine vollstaendige Ausgabe durch", () => {
    expect(validateExpenseDraft(ABENDESSEN)).toBeNull();
  });

  it("verlangt einen Titel", () => {
    expect(validateExpenseDraft({ ...ABENDESSEN, title: "   " })).toBe(
      "titleMissing",
    );
  });

  it("laesst hoechstens 80 Zeichen im Titel zu", () => {
    expect(
      validateExpenseDraft({ ...ABENDESSEN, title: "a".repeat(80) }),
    ).toBeNull();
    expect(
      validateExpenseDraft({
        ...ABENDESSEN,
        title: "a".repeat(EXPENSE_TITLE_MAX + 1),
      }),
    ).toBe("titleTooLong");
  });

  it("verlangt einen Betrag groesser als null", () => {
    expect(
      validateExpenseDraft({ ...ABENDESSEN, originalAmountCents: 0 }),
    ).toBe("amountInvalid");
    expect(
      validateExpenseDraft({ ...ABENDESSEN, originalAmountCents: -100 }),
    ).toBe("amountInvalid");
  });

  it("verlangt mindestens eine beteiligte Person", () => {
    expect(validateExpenseDraft({ ...ABENDESSEN, shares: [] })).toBe(
      "noParticipants",
    );
  });

  it("weist negative Anteile ab", () => {
    expect(
      validateExpenseDraft({
        ...ABENDESSEN,
        splitMode: "individuell",
        shares: [{ participantId: ANNA, amountCents: -1 }],
      }),
    ).toBe("shareInvalid");
  });

  it("weist dieselbe Person zweimal ab", () => {
    expect(
      validateExpenseDraft({
        ...ABENDESSEN,
        shares: [
          { participantId: ANNA, amountCents: 0 },
          { participantId: ANNA, amountCents: 0 },
        ],
      }),
    ).toBe("shareInvalid");
  });

  it("weist individuelle Anteile ab, die nicht den Gesamtbetrag ergeben", () => {
    expect(
      validateExpenseDraft({
        ...ABENDESSEN,
        splitMode: "individuell",
        shares: [
          { participantId: ANNA, amountCents: 2000 },
          { participantId: BEN, amountCents: 2000 },
          { participantId: CLARA, amountCents: 1500 },
        ],
      }),
    ).toBe("sharesMismatch");
  });

  it("laesst individuelle Anteile durch, die aufgehen", () => {
    expect(
      validateExpenseDraft({
        ...ABENDESSEN,
        splitMode: "individuell",
        shares: [
          { participantId: ANNA, amountCents: 2500 },
          { participantId: BEN, amountCents: 2000 },
          { participantId: CLARA, amountCents: 1500 },
        ],
      }),
    ).toBeNull();
  });
});
