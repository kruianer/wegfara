import { describe, expect, it } from "vitest";
import {
  DEFAULT_MINDESTBEWERTUNG,
  formatBewertung,
  hatPraeferenzen,
  INTERESSEN,
  isInteresse,
  LEERE_PRAEFERENZEN,
  MINDESTBEWERTUNGEN,
  normalisiereMindestbewertung,
  parseInteressen,
  serializeInteressen,
} from "./praeferenzen";

describe("Interessen (req-057)", () => {
  it("kennt genau die acht Interessen zum Ankreuzen", () => {
    expect(INTERESSEN).toHaveLength(8);
    expect(INTERESSEN).toContain("natur_wandern");
  });

  it("erkennt ein Interesse an der Grenze", () => {
    expect(isInteresse("natur_wandern")).toBe(true);
    expect(isInteresse("segeln")).toBe(false);
    expect(isInteresse(3)).toBe(false);
  });

  it("liest die angekreuzten Interessen aus der Ablage", () => {
    expect(parseInteressen("natur_wandern,geschichte")).toEqual([
      "natur_wandern",
      "geschichte",
    ]);
  });

  it("liest aus einem leeren Wert keine Interessen", () => {
    expect(parseInteressen("")).toEqual([]);
    expect(parseInteressen(null)).toEqual([]);
  });

  it("uebergeht einen unbekannten Eintrag, statt zu scheitern", () => {
    expect(parseInteressen("natur_wandern,segeln")).toEqual(["natur_wandern"]);
  });

  it("schreibt die Interessen immer in fester Reihenfolge", () => {
    expect(serializeInteressen(["geschichte", "kunst_museen"])).toBe(
      "kunst_museen,geschichte",
    );
  });

  it("liest zurueck, was es geschrieben hat", () => {
    const interessen = ["natur_wandern", "mit_kindern"] as const;
    expect(parseInteressen(serializeInteressen([...interessen]))).toEqual([
      ...interessen,
    ]);
  });
});

describe("Mindestbewertung (req-057)", () => {
  it("steht neu auf 0 -- keine Einschraenkung", () => {
    expect(DEFAULT_MINDESTBEWERTUNG).toBe(0);
    expect(LEERE_PRAEFERENZEN.mindestbewertung).toBe(0);
  });

  it("bietet 0 bis 5 in Halbschritten zur Auswahl", () => {
    expect(MINDESTBEWERTUNGEN).toHaveLength(11);
    expect(MINDESTBEWERTUNGEN[0]).toBe(0);
    expect(MINDESTBEWERTUNGEN[1]).toBe(0.5);
    expect(MINDESTBEWERTUNGEN.at(-1)).toBe(5);
  });

  it("rundet auf den naechsten Halbschritt", () => {
    expect(normalisiereMindestbewertung(4.3)).toBe(4.5);
    expect(normalisiereMindestbewertung(4.2)).toBe(4);
  });

  it("zwingt Werte in die Grenzen 0 bis 5", () => {
    expect(normalisiereMindestbewertung(-2)).toBe(0);
    expect(normalisiereMindestbewertung(9)).toBe(5);
  });

  it("liest einen als Text abgelegten Wert", () => {
    expect(normalisiereMindestbewertung("4.5")).toBe(4.5);
  });

  it("nimmt alles Unlesbare als keine Einschraenkung", () => {
    expect(normalisiereMindestbewertung(undefined)).toBe(0);
    expect(normalisiereMindestbewertung("viele Sterne")).toBe(0);
  });

  it("schreibt eine Bewertung mit Komma, die Null ohne Nachkomma", () => {
    expect(formatBewertung(4.5)).toBe("4,5");
    expect(formatBewertung(4)).toBe("4,0");
    expect(formatBewertung(0)).toBe("0");
  });
});

describe("hatPraeferenzen (req-057)", () => {
  it("verneint bei einer Reise ohne jede Praeferenz", () => {
    expect(hatPraeferenzen(LEERE_PRAEFERENZEN)).toBe(false);
  });

  it("bejaht schon bei einem angekreuzten Interesse", () => {
    expect(
      hatPraeferenzen({ ...LEERE_PRAEFERENZEN, interessen: ["nachtleben"] }),
    ).toBe(true);
  });

  it("bejaht bei einer gesetzten Mindestbewertung", () => {
    expect(
      hatPraeferenzen({ ...LEERE_PRAEFERENZEN, mindestbewertung: 4 }),
    ).toBe(true);
  });

  it("uebergeht einen Satz aus lauter Leerzeichen", () => {
    expect(hatPraeferenzen({ ...LEERE_PRAEFERENZEN, wertAuf: "   " })).toBe(
      false,
    );
  });
});
