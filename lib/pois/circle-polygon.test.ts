import { describe, expect, it } from "vitest";
import { buildCirclePolygon } from "./circle-polygon";
import { distanceKm } from "./distance";

describe("buildCirclePolygon", () => {
  it("liefert einen geschlossenen Ring", () => {
    const polygon = buildCirclePolygon({ lat: 40.85, lng: 14.27 }, 20);
    const ring = polygon.coordinates[0];

    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("liefert points+1 Koordinaten fuer die angegebene Punktzahl", () => {
    const polygon = buildCirclePolygon({ lat: 40.85, lng: 14.27 }, 20, 8);

    expect(polygon.coordinates[0]).toHaveLength(9);
  });

  it("liegen alle Randpunkte ungefaehr im angegebenen Abstand vom Mittelpunkt", () => {
    const center = { lat: 40.85, lng: 14.27 };
    const radiusKm = 30;
    const polygon = buildCirclePolygon(center, radiusKm, 32);

    for (const [lng, lat] of polygon.coordinates[0]) {
      // Der Umwegfaktor der Distanzfunktion (siehe distance.ts) verzerrt den
      // Vergleich um den Faktor 1.25 -- die Luftlinie zum Randpunkt bleibt
      // trotzdem nah am angegebenen Radius, ohne den Faktor hochgerechnet.
      expect(distanceKm({ lat, lng }, center) / 1.25).toBeCloseTo(radiusKm, 0);
    }
  });
});
