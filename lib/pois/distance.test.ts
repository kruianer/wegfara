import { describe, expect, it } from "vitest";
import { distanceKm } from "./distance";

describe("distanceKm", () => {
  it("liefert 0 fuer identische Positionen", () => {
    expect(distanceKm({ lat: 40.6, lng: 14.6 }, { lat: 40.6, lng: 14.6 })).toBe(
      0,
    );
  });

  it("berechnet die Distanz zwischen Neapel und Rom inkl. Umwegfaktor", () => {
    // Luftlinie Neapel-Rom ~188 km; mit dem Umwegfaktor 1.25 ~235 km.
    const neapel = { lat: 40.8518, lng: 14.2681 };
    const rom = { lat: 41.9028, lng: 12.4964 };

    expect(distanceKm(neapel, rom)).toBeCloseTo(235, -1);
  });

  it("ist symmetrisch", () => {
    const a = { lat: 40.85, lng: 14.27 };
    const b = { lat: 40.35, lng: 18.17 };

    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });
});
