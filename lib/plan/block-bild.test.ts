import { describe, expect, it } from "vitest";
import { blockBild } from "./block-bild";
import { TYP_ZEICHEN_PX, ZEITSTRAHL_BILD_PX } from "@/lib/design/stil";

describe("blockBild (req-111)", () => {
  it("zeigt das Bild bei einer und bei zwei Spuren, nicht bei dreien", () => {
    // Die Breiten bei der Untergrenze des Zeitstrahls (laneStyle).
    expect(blockBild({ breitePx: 408, hoehePx: 48 }).bild).toBe(true);
    expect(blockBild({ breitePx: 202, hoehePx: 48 }).bild).toBe(true);
    expect(blockBild({ breitePx: 133, hoehePx: 48 }).bild).toBe(false);
  });

  it("entscheidet an der Grenze aus lib/design/stil.ts", () => {
    const grenze = ZEITSTRAHL_BILD_PX.minBlockBreite;
    expect(blockBild({ breitePx: grenze, hoehePx: 48 }).bild).toBe(true);
    expect(blockBild({ breitePx: grenze - 1, hoehePx: 48 }).bild).toBe(false);
  });

  it("zeigt beides, solange der Block nicht gemessen ist", () => {
    expect(blockBild(undefined)).toEqual({ bild: true, zeichen: true });
  });

  it("zeigt das Zeichen nur, wenn der Block hoch genug ist", () => {
    const grenze = TYP_ZEICHEN_PX.minBlockHoehe;
    expect(blockBild({ breitePx: 408, hoehePx: grenze }).zeichen).toBe(true);
    expect(blockBild({ breitePx: 408, hoehePx: grenze - 1 }).zeichen).toBe(
      false,
    );
    // Der flachste Block (24 px) traegt keines.
    expect(blockBild({ breitePx: 408, hoehePx: 24 }).zeichen).toBe(false);
  });

  it("zeigt kein Zeichen ohne Bild", () => {
    expect(blockBild({ breitePx: 133, hoehePx: 176 }).zeichen).toBe(false);
  });
});
