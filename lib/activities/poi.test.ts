import { describe, expect, it } from "vitest";
import { poiIdsDerProgrammpunkte, poiZumProgrammpunkt } from "./poi";
import type { Poi } from "../pois/types";

function poi(id: string): Poi {
  return {
    id,
    tripId: "trip-1",
    number: 1,
    name: `Ort ${id}`,
    ort: "Amalfi",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6343, lng: 14.6027 },
    status: "gesetzt",
  };
}

describe("poiZumProgrammpunkt", () => {
  it("findet den POI, auf den der Programmpunkt zeigt", () => {
    const gefunden = poiZumProgrammpunkt({ poiId: "b" }, [poi("a"), poi("b")]);

    expect(gefunden?.id).toBe("b");
  });

  it("gibt ohne POI-Bezug nichts zurueck", () => {
    expect(poiZumProgrammpunkt({}, [poi("a")])).toBeUndefined();
  });

  it("gibt nichts zurueck, wenn der POI nicht vorliegt", () => {
    expect(poiZumProgrammpunkt({ poiId: "c" }, [poi("a")])).toBeUndefined();
  });
});

describe("poiIdsDerProgrammpunkte", () => {
  it("nennt jede Kennung einmal und laesst Programmpunkte ohne POI aus", () => {
    const ids = poiIdsDerProgrammpunkte([
      { poiId: "a" },
      { poiId: "b" },
      { poiId: "a" },
      {},
    ]);

    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});
