import { describe, expect, it } from "vitest";
import { kontrastVerhaeltnis, leuchtdichte } from "@/lib/design/kontrast";
import { KARTEN_GRUND, TAGESFARBEN, tagesfarbe } from "./tagesfarben";

describe("Tagesfarben (req-103)", () => {
  it("sind sieben", () => {
    expect(TAGESFARBEN).toHaveLength(7);
  });

  it.each(TAGESFARBEN.map((f) => [f.name, f.wert]))(
    "%s steht mit mindestens 4,5:1 auf dem Kartengrund",
    (_name, wert) => {
      expect(kontrastVerhaeltnis(wert, KARTEN_GRUND)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  /**
   * Im Schwarzweiss-Druck bleibt von einer Farbe nur ihre Helligkeit -- keine
   * zwei Tage duerfen darin zusammenfallen.
   */
  it("sind unterschiedlich hell, nicht nur unterschiedlich bunt", () => {
    const hell = TAGESFARBEN.map((f) => leuchtdichte(f.wert)).sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < hell.length; i++) {
      expect(hell[i] - hell[i - 1]).toBeGreaterThan(0.01);
    }
  });

  it("wiederholen sich ab dem achten Tag", () => {
    expect(tagesfarbe(8)).toBe(tagesfarbe(1));
    expect(tagesfarbe(9)).toBe(tagesfarbe(2));
    expect(new Set([1, 2, 3, 4, 5, 6, 7].map(tagesfarbe)).size).toBe(7);
  });
});
