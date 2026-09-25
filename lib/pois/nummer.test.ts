import { describe, expect, it } from "vitest";
import { activityPoiNummer, formatPoiNummer, poiNummernNachId } from "./nummer";
import type { Poi } from "./types";

function poi(id: string, number: number): Poi {
  return {
    id,
    tripId: "trip-1",
    number,
    name: `POI ${number}`,
    ort: "Pompei",
    type: "sehenswuerdigkeit",
    position: { lat: 40.7489, lng: 14.4989 },
    status: "gesetzt",
  };
}

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

/**
 * Die Nummer eines Programmpunkts kommt von seinem POI (req-074,
 * Constraints) -- ueber `poiId`, und nirgends aus einer eigenen Zaehlung.
 */
describe("activityPoiNummer (req-074)", () => {
  const NUMMERN = poiNummernNachId([
    poi("poi-pompeji", 14),
    poi("poi-villa", 3),
  ]);

  it("nennt die Nummer des POI, aus dem der Programmpunkt entstanden ist", () => {
    expect(activityPoiNummer({ poiId: "poi-pompeji" }, NUMMERN)).toBe(14);
    expect(activityPoiNummer({ poiId: "poi-villa" }, NUMMERN)).toBe(3);
  });

  it("nennt fuer einen von Hand angelegten Programmpunkt keine", () => {
    // Ohne POI keine Nummer -- und kein Platzhalter an ihrer Stelle.
    expect(activityPoiNummer({}, NUMMERN)).toBeNull();
    expect(activityPoiNummer({ poiId: undefined }, NUMMERN)).toBeNull();
  });

  it("nennt keine, wenn der POI nicht unter den gefuehrten ist", () => {
    // Etwa, weil er einer anderen Reise gehoert -- erfunden wird nichts.
    expect(activityPoiNummer({ poiId: "poi-fremd" }, NUMMERN)).toBeNull();
  });
});
