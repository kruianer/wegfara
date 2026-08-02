import { describe, expect, it } from "vitest";
import {
  canRemovePoint,
  edgeMidpoints,
  insertMidpoint,
  movePointAt,
  removePointAt,
  toLineGeometry,
  toPolygonGeometry,
} from "./search-area";

const SQUARE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 2 },
  { lat: 2, lng: 2 },
  { lat: 2, lng: 0 },
];

describe("canRemovePoint", () => {
  it("erlaubt das Entfernen, wenn mehr als drei Eckpunkte vorhanden sind", () => {
    expect(canRemovePoint(SQUARE)).toBe(true);
  });

  it("verbietet das Entfernen bei genau drei Eckpunkten", () => {
    expect(canRemovePoint(SQUARE.slice(0, 3))).toBe(false);
  });
});

describe("removePointAt", () => {
  it("entfernt den Eckpunkt am angegebenen Index", () => {
    const result = removePointAt(SQUARE, 1);
    expect(result).toEqual([SQUARE[0], SQUARE[2], SQUARE[3]]);
  });

  it("laesst die Flaeche unveraendert, wenn nur drei Eckpunkte uebrig blieben", () => {
    const triangle = SQUARE.slice(0, 3);
    const result = removePointAt(triangle, 0);
    expect(result).toEqual(triangle);
  });
});

describe("movePointAt", () => {
  it("verschiebt genau den Eckpunkt am angegebenen Index", () => {
    const moved = movePointAt(SQUARE, 0, { lat: 9, lng: 9 });
    expect(moved[0]).toEqual({ lat: 9, lng: 9 });
    expect(moved.slice(1)).toEqual(SQUARE.slice(1));
  });
});

describe("edgeMidpoints", () => {
  it("liefert einen Griff pro Kante, einschliesslich der schliessenden Kante", () => {
    const midpoints = edgeMidpoints(SQUARE);
    expect(midpoints).toHaveLength(4);
    expect(midpoints[0]).toEqual({ lat: 0, lng: 1 });
    expect(midpoints[3]).toEqual({ lat: 1, lng: 0 });
  });
});

describe("insertMidpoint", () => {
  it("fuegt einen neuen Punkt in der Mitte der angegebenen Kante ein", () => {
    const result = insertMidpoint(SQUARE, 0);
    expect(result).toHaveLength(5);
    expect(result[1]).toEqual({ lat: 0, lng: 1 });
    expect(result[0]).toEqual(SQUARE[0]);
    expect(result[2]).toEqual(SQUARE[1]);
  });
});

describe("toPolygonGeometry", () => {
  it("liefert einen geschlossenen Ring", () => {
    const polygon = toPolygonGeometry(SQUARE);
    const ring = polygon.coordinates[0];
    expect(ring).toHaveLength(SQUARE.length + 1);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

describe("toLineGeometry", () => {
  it("liefert eine offene Linie mit einer Koordinate je Punkt", () => {
    const line = toLineGeometry(SQUARE.slice(0, 2));
    expect(line.coordinates).toEqual([
      [0, 0],
      [2, 0],
    ]);
  });
});
