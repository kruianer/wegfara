import type { PoiPosition } from "./types";

/** Ein Suchgebiet einer Reise: eine geordnete Kette von Eckpunkten (siehe req-012). */
export interface SearchArea {
  tripId: string;
  points: PoiPosition[];
}

/** Ab dieser Anzahl Eckpunkte darf eine Flaeche geschlossen werden und bleibt bestehen. */
export const MIN_SEARCH_AREA_POINTS = 3;

export function canRemovePoint(points: PoiPosition[]): boolean {
  return points.length > MIN_SEARCH_AREA_POINTS;
}

/** Entfernt den Eckpunkt am Index, ausser es blieben dann weniger als drei uebrig. */
export function removePointAt(
  points: PoiPosition[],
  index: number,
): PoiPosition[] {
  if (!canRemovePoint(points)) return points;
  return points.filter((_, i) => i !== index);
}

export function movePointAt(
  points: PoiPosition[],
  index: number,
  position: PoiPosition,
): PoiPosition[] {
  return points.map((point, i) => (i === index ? position : point));
}

function midpoint(a: PoiPosition, b: PoiPosition): PoiPosition {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Ein Griff pro Kante der geschlossenen Flaeche, in der Mitte zwischen zwei
 * benachbarten Eckpunkten -- auch zwischen dem letzten und dem ersten.
 */
export function edgeMidpoints(points: PoiPosition[]): PoiPosition[] {
  return points.map((point, i) =>
    midpoint(point, points[(i + 1) % points.length]),
  );
}

/** Fuegt hinter dem Eckpunkt bei edgeIndex einen neuen Punkt in der Kantenmitte ein. */
export function insertMidpoint(
  points: PoiPosition[],
  edgeIndex: number,
): PoiPosition[] {
  const inserted = edgeMidpoints(points)[edgeIndex];
  const next = [...points];
  next.splice(edgeIndex + 1, 0, inserted);
  return next;
}

/** Geschlossener Ring fuer die Darstellung der fertigen Flaeche. */
export function toPolygonGeometry(points: PoiPosition[]): GeoJSON.Polygon {
  const ring: [number, number][] = points.map((p) => [p.lng, p.lat]);
  ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

/** Offene Linie fuer die Vorschau waehrend des Zeichnens. */
export function toLineGeometry(points: PoiPosition[]): GeoJSON.LineString {
  return { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) };
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Kleinstes achsenparalleles Rechteck um alle Eckpunkte (siehe req-014, Schritt 1). */
export function boundingBox(points: PoiPosition[]): BoundingBox {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function boxCenter(box: BoundingBox): PoiPosition {
  return {
    lat: (box.minLat + box.maxLat) / 2,
    lng: (box.minLng + box.maxLng) / 2,
  };
}

/** Mittelpunkt des Suchgebiets, z.B. fuer die Regionsbestimmung (siehe req-014, Schritt 1). */
export function searchAreaCenter(points: PoiPosition[]): PoiPosition {
  return boxCenter(boundingBox(points));
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: PoiPosition, b: PoiPosition): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Ungefaehre Breite und Hoehe des Suchgebiets in km (siehe req-014, Schritt 1). */
export function approximateExtentKm(points: PoiPosition[]): {
  widthKm: number;
  heightKm: number;
} {
  const box = boundingBox(points);
  const center = boxCenter(box);
  return {
    widthKm: haversineKm(
      { lat: center.lat, lng: box.minLng },
      { lat: center.lat, lng: box.maxLng },
    ),
    heightKm: haversineKm(
      { lat: box.minLat, lng: center.lng },
      { lat: box.maxLat, lng: center.lng },
    ),
  };
}

/**
 * Punkt-in-Polygon-Test per Ray-Casting (siehe req-014, Schritt 4): liegt
 * `point` innerhalb der von `areaPoints` aufgespannten Flaeche?
 */
export function isInsideArea(
  point: PoiPosition,
  areaPoints: PoiPosition[],
): boolean {
  let inside = false;
  for (let i = 0, j = areaPoints.length - 1; i < areaPoints.length; j = i++) {
    const pi = areaPoints[i];
    const pj = areaPoints[j];
    const crosses =
      pi.lat > point.lat !== pj.lat > point.lat &&
      point.lng <
        ((pj.lng - pi.lng) * (point.lat - pi.lat)) / (pj.lat - pi.lat) + pi.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}
