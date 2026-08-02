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
