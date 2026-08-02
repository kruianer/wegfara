import type { PoiPosition } from "./types";

const EARTH_RADIUS_KM = 6371;

/**
 * Naeherungsweises Kreis-Polygon um einen Mittelpunkt (Kugel-Approximation),
 * fuer die Darstellung der Cluster-Zonen als GeoJSON-Layer auf der Karte
 * (siehe req-010).
 */
export function buildCirclePolygon(
  center: PoiPosition,
  radiusKm: number,
  points = 64,
): GeoJSON.Polygon {
  const latRad = (center.lat * Math.PI) / 180;
  const coordinates: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusKm / EARTH_RADIUS_KM) * Math.cos(angle);
    const dLng =
      ((radiusKm / EARTH_RADIUS_KM) * Math.sin(angle)) / Math.cos(latRad);
    coordinates.push([
      center.lng + (dLng * 180) / Math.PI,
      center.lat + (dLat * 180) / Math.PI,
    ]);
  }

  return { type: "Polygon", coordinates: [coordinates] };
}
