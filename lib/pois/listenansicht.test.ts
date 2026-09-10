import { describe, expect, it } from "vitest";
import {
  gefiltertePois,
  LEERER_POI_FILTER,
  type PoiFilter,
} from "./listenansicht";
import type { Poi } from "./types";

function poi(overrides: Partial<Poi> & { id: string; name: string }): Poi {
  return {
    tripId: "trip-1",
    number: 1,
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.85, lng: 14.27 },
    status: "weiss_nicht",
    ...overrides,
  };
}

const POIS: Poi[] = [
  poi({ id: "a", name: "Villa Rufolo", number: 1, status: "gesetzt" }),
  poi({
    id: "b",
    name: "Trattoria da Nennella",
    number: 2,
    type: "restaurant",
    status: "gesetzt",
  }),
  poi({
    id: "c",
    name: "Da Vincenzo",
    number: 3,
    type: "restaurant",
    status: "wenn_zeit",
  }),
];

function filter(overrides: Partial<PoiFilter> = {}): PoiFilter {
  return { ...LEERER_POI_FILTER, ...overrides };
}

describe("gefiltertePois (req-060)", () => {
  it("zeigt ohne Filter alle POIs", () => {
    expect(gefiltertePois(POIS, LEERER_POI_FILTER)).toEqual(POIS);
  });

  it("zeigt bei gewaehltem Typ nur POIs dieses Typs", () => {
    const gezeigt = gefiltertePois(POIS, filter({ typeFilter: "restaurant" }));

    expect(gezeigt.map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("zeigt bei gewaehltem Status nur POIs dieses Status", () => {
    const gezeigt = gefiltertePois(POIS, filter({ statusFilter: "gesetzt" }));

    expect(gezeigt.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("verlangt beide Filter zugleich", () => {
    const gezeigt = gefiltertePois(
      POIS,
      filter({ typeFilter: "restaurant", statusFilter: "gesetzt" }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["b"]);
  });

  it("laesst die Reihenfolge, in der die POIs hereinkommen", () => {
    const gezeigt = gefiltertePois(
      [...POIS].reverse(),
      filter({ statusFilter: "gesetzt" }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
