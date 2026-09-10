import { describe, expect, it } from "vitest";
import {
  gefiltertePois,
  sortiertePois,
  LEERER_POI_FILTER,
  VORGEWAEHLTE_SORTIERUNG,
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

describe("sortiertePois (req-060)", () => {
  const NACH_NUMMER: Poi[] = [
    poi({ id: "a", name: "Villa Rufolo", number: 1, status: "wenn_zeit" }),
    poi({
      id: "b",
      name: "Ausgrabungsstätte Pompeji",
      number: 2,
      status: "gesetzt",
      bewertung: 4.5,
    }),
    poi({
      id: "c",
      name: "Bucht bei Praiano",
      number: 3,
      status: "weiss_nicht",
      bewertung: 4.8,
    }),
  ];

  /** Die Sortierung arbeitet auf einer beliebigen Reihenfolge. */
  const GEMISCHT = [NACH_NUMMER[2], NACH_NUMMER[0], NACH_NUMMER[1]];

  it("ordnet vorgewaehlt nach Nummer", () => {
    expect(
      sortiertePois(GEMISCHT, VORGEWAEHLTE_SORTIERUNG).map((p) => p.number),
    ).toEqual([1, 2, 3]);
    expect(VORGEWAEHLTE_SORTIERUNG).toBe("nummer");
  });

  it("ordnet nach Name", () => {
    expect(sortiertePois(GEMISCHT, "name").map((p) => p.name)).toEqual([
      "Ausgrabungsstätte Pompeji",
      "Bucht bei Praiano",
      "Villa Rufolo",
    ]);
  });

  it("ordnet nach Status, Gesetzt zuerst", () => {
    expect(sortiertePois(GEMISCHT, "status").map((p) => p.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("ordnet nach Bewertung, die beste zuerst", () => {
    expect(sortiertePois(GEMISCHT, "bewertung").map((p) => p.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("stellt POIs ohne Bewertung ans Ende", () => {
    const ohne = [
      poi({ id: "x", name: "Ohne", number: 1 }),
      poi({ id: "y", name: "Auch ohne", number: 2 }),
      poi({ id: "z", name: "Mit", number: 3, bewertung: 3.1 }),
    ];

    expect(sortiertePois(ohne, "bewertung").map((p) => p.id)).toEqual([
      "z",
      "x",
      "y",
    ]);
  });

  it("entscheidet bei gleichem Wert nach der Nummer", () => {
    const gleich = [
      poi({ id: "spaet", name: "Gleich", number: 9, bewertung: 4 }),
      poi({ id: "frueh", name: "Gleich", number: 2, bewertung: 4 }),
    ];

    expect(sortiertePois(gleich, "bewertung").map((p) => p.id)).toEqual([
      "frueh",
      "spaet",
    ]);
    expect(sortiertePois(gleich, "name").map((p) => p.id)).toEqual([
      "frueh",
      "spaet",
    ]);
  });

  it("laesst die hereingereichte Liste unveraendert", () => {
    const vorher = [...GEMISCHT];

    sortiertePois(GEMISCHT, "name");

    expect(GEMISCHT).toEqual(vorher);
  });
});
