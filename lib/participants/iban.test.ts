import { describe, expect, it } from "vitest";
import { isValidIban, normalizeIban } from "./iban";

describe("normalizeIban (req-019)", () => {
  it("entfernt Leerzeichen und schreibt gross", () => {
    expect(normalizeIban(" at61 1904 3002 3457 3201 ")).toBe(
      "AT611904300234573201",
    );
  });
});

describe("isValidIban (req-019)", () => {
  it.each([
    ["AT611904300234573201", "Österreich"],
    ["AT61 1904 3002 3457 3201", "Österreich, mit Leerzeichen"],
    ["at611904300234573201", "Österreich, klein geschrieben"],
    ["DE89370400440532013000", "Deutschland"],
    ["CH9300762011623852957", "Schweiz"],
    ["GB82WEST12345698765432", "Vereinigtes Königreich"],
  ])("nimmt %s an (%s)", (iban) => {
    expect(isValidIban(iban)).toBe(true);
  });

  it("weist eine falsche Pruefziffer zurueck", () => {
    expect(isValidIban("AT611904300234573200")).toBe(false);
  });

  it("weist vertauschte Ziffern zurueck", () => {
    expect(isValidIban("AT611904300234573210")).toBe(false);
  });

  it.each([
    ["", "leer"],
    ["AT61", "zu kurz"],
    ["6119043002345732", "ohne Laenderkennzeichen"],
    ["ATXX1904300234573201", "Pruefziffern keine Ziffern"],
    ["AT61-1904-3002-3457-3201", "mit Bindestrichen"],
    ["AT6119043002345732011904300234573201123", "zu lang"],
  ])("weist %s zurueck (%s)", (value) => {
    expect(isValidIban(value)).toBe(false);
  });
});
