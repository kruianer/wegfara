import { describe, expect, it } from "vitest";
import { KOSTEN_ANZAHL_MAX, parseAnzahl } from "./anzahl";

describe("parseAnzahl (req-062)", () => {
  it("liest eine ganze Zahl", () => {
    expect(parseAnzahl("1")).toBe(1);
    expect(parseAnzahl(" 12 ")).toBe(12);
    expect(parseAnzahl("0")).toBe(0);
  });

  /** Leer heisst: die Zeile zieht wieder mit der Teilnehmerzahl nach. */
  it("ergibt bei leerer Eingabe null", () => {
    expect(parseAnzahl("")).toBeNull();
    expect(parseAnzahl("   ")).toBeNull();
  });

  it("weist ab, was keine ganze Zahl ist", () => {
    expect(parseAnzahl("abc")).toBe("ungueltig");
    expect(parseAnzahl("1,5")).toBe("ungueltig");
    expect(parseAnzahl("-2")).toBe("ungueltig");
  });

  it("weist eine verrutschte Zahl oberhalb der Grenze ab", () => {
    expect(parseAnzahl(String(KOSTEN_ANZAHL_MAX))).toBe(KOSTEN_ANZAHL_MAX);
    expect(parseAnzahl(String(KOSTEN_ANZAHL_MAX + 1))).toBe("ungueltig");
  });
});
