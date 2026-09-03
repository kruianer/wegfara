import { describe, expect, it } from "vitest";
import {
  formatCents,
  formatEuro,
  formatMoney,
  parseAmountToCents,
  toEuroCents,
} from "./money";

describe("parseAmountToCents (req-029)", () => {
  it("liest einen Betrag mit Komma als Cent", () => {
    expect(parseAmountToCents("60,00")).toBe(6000);
    expect(parseAmountToCents("95,50")).toBe(9550);
  });

  it("liest auch einen Betrag mit Punkt als Dezimaltrenner", () => {
    expect(parseAmountToCents("12.34")).toBe(1234);
  });

  it("ergaenzt fehlende Nachkommastellen", () => {
    expect(parseAmountToCents("7")).toBe(700);
    expect(parseAmountToCents("7,5")).toBe(750);
  });

  it("weist an, was kein Betrag ist", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("-5,00")).toBeNull();
    expect(parseAmountToCents("1,234")).toBeNull();
  });
});

describe("Betraege anzeigen (req-029)", () => {
  it("zeigt zwei Nachkommastellen", () => {
    expect(formatCents(6000)).toBe("60,00");
    expect(formatCents(5)).toBe("0,05");
  });

  it("zeigt den Euro-Betrag mit dem Euro-Zeichen", () => {
    expect(formatEuro(2000)).toBe("20,00 €");
  });

  it("zeigt einen Betrag in fremder Waehrung mit ihrer Bezeichnung", () => {
    expect(formatMoney(9500, "CHF")).toBe("95,00 CHF");
    expect(formatMoney(1000, "USD")).toBe("10,00 $");
    expect(formatMoney(1000, "GBP")).toBe("10,00 £");
  });
});

describe("toEuroCents (req-029)", () => {
  it("rechnet mit dem uebergebenen Kurs und rundet auf ganze Cent", () => {
    expect(toEuroCents(9500, 1.06)).toBe(10070);
    expect(toEuroCents(333, 0.865)).toBe(288);
  });

  it("laesst einen Euro-Betrag unveraendert", () => {
    expect(toEuroCents(6000, 1)).toBe(6000);
  });
});
