import { describe, expect, it } from "vitest";
import { bewertungKurz, bewertungText } from "./bewertung";

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

describe("bewertungKurz (req-097)", () => {
  it("liefert ohne Bewertung nichts", () => {
    expect(bewertungKurz({})).toBeNull();
  });

  it("nennt die Note mit Komma und ohne Anzahl, wenn keine bekannt ist", () => {
    expect(bewertungKurz({ bewertung: 4.66 })).toEqual({
      note: "4,7",
      anzahl: null,
    });
  });

  it("rundet die Anzahl knapp, damit sie neben die Buchung passt", () => {
    expect(bewertungKurz({ bewertung: 4, bewertungAnzahl: 240 })?.anzahl).toBe(
      "240",
    );
    expect(bewertungKurz({ bewertung: 4, bewertungAnzahl: 1240 })?.anzahl).toBe(
      "1,2k",
    );
    expect(bewertungKurz({ bewertung: 4, bewertungAnzahl: 8312 })?.anzahl).toBe(
      "8,3k",
    );
    expect(
      bewertungKurz({ bewertung: 4, bewertungAnzahl: 61204 })?.anzahl,
    ).toBe("61k");
  });
});
