import { describe, expect, it } from "vitest";
import { formatPoiNummer } from "./nummer";

/**
 * Die Nummer eines POI wird nirgends neu gezaehlt (req-074, Constraints) --
 * geschrieben wird sie an allen Stellen des Planers gleich.
 */
describe("formatPoiNummer (req-074)", () => {
  it("schreibt die Nummer mit dem Gitter davor", () => {
    expect(formatPoiNummer(14)).toBe("#14");
  });

  it("laesst die Zahl unveraendert -- auch ein- und dreistellig", () => {
    expect(formatPoiNummer(1)).toBe("#1");
    expect(formatPoiNummer(137)).toBe("#137");
  });
});
