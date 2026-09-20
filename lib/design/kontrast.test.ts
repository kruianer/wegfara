import { describe, expect, it } from "vitest";
import {
  kontrastVerhaeltnis,
  leuchtdichte,
  MINDESTKONTRAST_FLIESSTEXT,
} from "./kontrast";

describe("Kontrast (bug-051)", () => {
  it("kennt die Eckwerte der Leuchtdichte", () => {
    expect(leuchtdichte("#000000")).toBe(0);
    expect(leuchtdichte("#ffffff")).toBeCloseTo(1, 5);
  });

  it("liest die Kurzschreibweise wie die lange", () => {
    expect(leuchtdichte("#fff")).toBeCloseTo(leuchtdichte("#ffffff"), 10);
  });

  it("rechnet Schwarz auf Weiss als 21:1", () => {
    expect(kontrastVerhaeltnis("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("rechnet dieselbe Farbe als 1:1", () => {
    expect(kontrastVerhaeltnis("#131730", "#131730")).toBeCloseTo(1, 10);
  });

  it("rechnet unabhaengig von der Reihenfolge", () => {
    expect(kontrastVerhaeltnis("#e9ebf7", "#131730")).toBeCloseTo(
      kontrastVerhaeltnis("#131730", "#e9ebf7"),
      10,
    );
  });

  /**
   * Der Wert aus der Ursachen-Tabelle von bug-051: die hellste Textstufe
   * auf der Kartenflaeche. Er belegt, dass hier dieselbe Rechnung laeuft,
   * mit der der Bug vermessen wurde.
   */
  it("bestaetigt die gemessenen Werte der Farbwelt", () => {
    expect(kontrastVerhaeltnis("#e9ebf7", "#131730")).toBeCloseTo(14.8, 1);
    expect(kontrastVerhaeltnis("#b3bad8", "#171c38")).toBeCloseTo(8.7, 1);
  });

  it("weist Farben zurueck, die keine Hex-Werte sind", () => {
    expect(() => leuchtdichte("rgba(166, 180, 232, 0.16)")).toThrow();
    expect(() => leuchtdichte("indigo")).toThrow();
  });

  it("nennt die Grenze fuer Fliesstext", () => {
    expect(MINDESTKONTRAST_FLIESSTEXT).toBe(4.5);
  });
});
