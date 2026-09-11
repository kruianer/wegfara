import { describe, expect, it } from "vitest";
import {
  formatKosten,
  kostenText,
  parseKosten,
  POI_KOSTEN_MAX_CENT,
} from "./kosten";

describe("parseKosten (req-061)", () => {
  it("liest den Betrag mit Komma als Cent", () => {
    expect(parseKosten("12,50")).toBe(1250);
  });

  it("liest den Betrag auch mit Punkt", () => {
    expect(parseKosten("12.50")).toBe(1250);
  });

  it("liest eine einzelne Nachkommastelle als Zehntel-Euro", () => {
    expect(parseKosten("12,5")).toBe(1250);
  });

  it("liest einen ganzen Betrag ohne Nachkommastellen", () => {
    expect(parseKosten("12")).toBe(1200);
  });

  it("uebergeht Leerzeichen und ein Euro-Zeichen dahinter", () => {
    expect(parseKosten(" 12,50 € ")).toBe(1250);
  });

  it("unterscheidet 'nicht eingetragen' von 'kostet nichts'", () => {
    expect(parseKosten("")).toBeNull();
    expect(parseKosten("   ")).toBeNull();
    expect(parseKosten("0")).toBe(0);
  });

  it("weist einen Buchstaben ab", () => {
    expect(parseKosten("abc")).toBe("ungueltig");
    expect(parseKosten("12,50x")).toBe("ungueltig");
  });

  it("weist einen negativen Betrag ab", () => {
    expect(parseKosten("-5")).toBe("ungueltig");
  });

  it("weist mehr als zwei Nachkommastellen ab", () => {
    expect(parseKosten("12,505")).toBe("ungueltig");
  });

  it("weist einen Betrag ueber der Obergrenze ab", () => {
    expect(parseKosten(formatKosten(POI_KOSTEN_MAX_CENT))).toBe(
      POI_KOSTEN_MAX_CENT,
    );
    expect(parseKosten(formatKosten(POI_KOSTEN_MAX_CENT + 1))).toBe(
      "ungueltig",
    );
  });
});

describe("formatKosten (req-061)", () => {
  it("schreibt den Betrag mit Komma und zwei Nachkommastellen", () => {
    expect(formatKosten(1250)).toBe("12,50");
    expect(formatKosten(1200)).toBe("12,00");
    expect(formatKosten(0)).toBe("0,00");
  });

  it("liest zurueck, was es geschrieben hat", () => {
    expect(parseKosten(formatKosten(1250))).toBe(1250);
  });
});

describe("kostenText (req-061)", () => {
  it("nennt den Betrag je Person", () => {
    expect(kostenText({ kostenCent: 1250 })).toBe("12,50 € pro Person");
  });

  it("nennt auch den Betrag null — kostenlos ist eine Angabe", () => {
    expect(kostenText({ kostenCent: 0 })).toBe("0,00 € pro Person");
  });

  it("liefert null fuer einen POI ohne eingetragene Kosten", () => {
    expect(kostenText({})).toBeNull();
  });
});
