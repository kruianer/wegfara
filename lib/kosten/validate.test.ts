import { describe, expect, it } from "vitest";
import {
  bezeichnungProblem,
  KOSTEN_BEZEICHNUNG_MAX_LENGTH,
  KOSTEN_ERRORS,
} from "./validate";

describe("bezeichnungProblem (req-062)", () => {
  it("nimmt eine gewoehnliche Bezeichnung an", () => {
    expect(bezeichnungProblem("Maut")).toBeNull();
    expect(bezeichnungProblem("  Parkgebühren  ")).toBeNull();
  });

  it("verlangt ueberhaupt eine Bezeichnung", () => {
    expect(bezeichnungProblem("")).toBe(KOSTEN_ERRORS.bezeichnungFehlt);
    expect(bezeichnungProblem("   ")).toBe(KOSTEN_ERRORS.bezeichnungFehlt);
  });

  it("weist eine zu lange Bezeichnung ab", () => {
    expect(
      bezeichnungProblem("x".repeat(KOSTEN_BEZEICHNUNG_MAX_LENGTH)),
    ).toBeNull();
    expect(
      bezeichnungProblem("x".repeat(KOSTEN_BEZEICHNUNG_MAX_LENGTH + 1)),
    ).toBe(KOSTEN_ERRORS.bezeichnungZuLang);
  });
});
