import { describe, expect, it } from "vitest";
import { kleineFotoAnzahl, stationLayouts } from "./layouts";
import type { StationLayout } from "./types";

/**
 * Der Wechsel der fuenf Layouts folgt einer Regel, nicht dem Zufall
 * (req-080): erste grosse Station L1, die naechste grosse L2, danach
 * wechselnd L3 und L4, Nebenstationen immer L5.
 */
describe("stationLayouts (req-080)", () => {
  it("gibt der ersten Station des Tages L1", () => {
    expect(stationLayouts(["gross"])).toEqual(["l1"]);
  });

  it("gibt vier grossen Stationen vier verschiedene Layouts", () => {
    const layouts = stationLayouts(["gross", "gross", "gross", "gross"]);

    expect(layouts).toEqual(["l1", "l2", "l3", "l4"]);
    expect(new Set(layouts).size).toBe(4);
  });

  it("wechselt danach zwischen L3 und L4", () => {
    expect(
      stationLayouts(["gross", "gross", "gross", "gross", "gross", "gross"]),
    ).toEqual(["l1", "l2", "l3", "l4", "l3", "l4"]);
  });

  it("stellt nie zwei gleiche Layouts untereinander", () => {
    const layouts = stationLayouts(Array<"gross">(10).fill("gross"));

    for (let i = 1; i < layouts.length; i += 1) {
      expect(layouts[i]).not.toBe(layouts[i - 1]);
    }
  });

  it("gibt jeder Nebenstation L5", () => {
    expect(stationLayouts(["neben", "neben"])).toEqual(["l5", "l5"]);
  });

  it("laesst Nebenstationen die Regel der grossen nicht verschieben", () => {
    // Die Reihe des Mockups: L1, dann die Nebenstation, dann die naechste
    // grosse -- und die traegt L2, nicht L3.
    expect(stationLayouts(["gross", "neben", "gross", "gross"])).toEqual([
      "l1",
      "l5",
      "l2",
      "l3",
    ]);
  });

  it("beginnt auch dann mit L1, wenn der Tag mit einer Nebenstation anfaengt", () => {
    expect(stationLayouts(["neben", "gross"])).toEqual(["l5", "l1"]);
  });

  it("kommt mit einem Tag ohne Stationen aus", () => {
    expect(stationLayouts([])).toEqual([]);
  });
});

describe("kleineFotoAnzahl (req-080)", () => {
  it("zeigt je Layout zwei oder drei kleine Fotos", () => {
    const anzahl: Record<StationLayout, number> = {
      l1: 2,
      l2: 3,
      l3: 3,
      l4: 2,
      l5: 0,
    };

    for (const [layout, erwartet] of Object.entries(anzahl)) {
      expect(kleineFotoAnzahl(layout as StationLayout)).toBe(erwartet);
    }
  });
});
