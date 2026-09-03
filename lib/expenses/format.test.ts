import { describe, expect, it } from "vitest";
import { formatBeneficiaries, formatExpenseDate } from "./format";

describe("formatExpenseDate (req-029)", () => {
  it("zeigt Tag, Monat und Jahr", () => {
    expect(formatExpenseDate("2026-07-20T12:00:00.000Z")).toBe("20.07.2026");
  });
});

describe("formatBeneficiaries (req-029)", () => {
  it("nennt „für alle“, wenn jeder Teilnehmer beteiligt ist", () => {
    expect(formatBeneficiaries(6, 6)).toBe("für alle");
  });

  it("nennt sonst die Zahl der Beteiligten", () => {
    expect(formatBeneficiaries(3, 6)).toBe("für 3 Personen");
    expect(formatBeneficiaries(1, 6)).toBe("für 1 Person");
  });
});
