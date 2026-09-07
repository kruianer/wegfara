import { describe, expect, it } from "vitest";
import { bewertungText } from "./bewertung";

describe("bewertungText (req-057)", () => {
  it("nennt die Note und die Anzahl dahinter", () => {
    expect(bewertungText({ bewertung: 4.6, bewertungAnzahl: 1240 })).toBe(
      "4,6 aus 1.240",
    );
  });

  it("schreibt eine glatte Note mit einer Nachkommastelle", () => {
    expect(bewertungText({ bewertung: 4, bewertungAnzahl: 8 })).toBe(
      "4,0 aus 8",
    );
  });

  it("nennt ohne Anzahl allein die Note", () => {
    expect(bewertungText({ bewertung: 4.6 })).toBe("4,6");
  });

  it("liefert null fuer einen POI ohne Bewertung", () => {
    expect(bewertungText({})).toBeNull();
    expect(bewertungText({ bewertungAnzahl: 1240 })).toBeNull();
  });
});
