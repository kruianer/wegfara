import { describe, expect, it } from "vitest";
import { isPlannablePoi, plannablePois, poiPlanCounts } from "./plannable";
import type { Poi } from "./types";
import type { Activity } from "@/lib/activities/types";

function poi(overrides: Partial<Poi> & { id: string }): Poi {
  return {
    tripId: "trip-1",
    number: 1,
    name: "POI",
    ort: "Ort",
    type: "sehenswuerdigkeit",
    position: { lat: 40.85, lng: 14.27 },
    status: "gesetzt",
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Programmpunkt",
    shortText: "kurz",
    longText: "lang",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T11:00",
    ...overrides,
  };
}

describe("plannablePois", () => {
  it("enthaelt einen gesetzten POI", () => {
    const pois = [poi({ id: "a", status: "gesetzt" })];

    expect(plannablePois(pois)).toEqual(pois);
  });

  it('enthaelt einen POI mit Status "Wahrscheinlich"', () => {
    const pois = [poi({ id: "a", status: "wahrscheinlich" })];

    expect(plannablePois(pois)).toEqual(pois);
  });

  it.each(["weiss_nicht", "wenn_zeit", "auf_keinen_fall"] as const)(
    'enthaelt einen POI mit Status "%s" NICHT',
    (status) => {
      const pois = [poi({ id: "a", status })];

      expect(plannablePois(pois)).toEqual([]);
    },
  );

  it("enthaelt einen bereits verplanten POI weiterhin (req-083)", () => {
    // Bis req-083 schloss diese Liste verplante POIs aus -- seit req-083
    // bleibt ein POI auch nach dem Verplanen in der Auswahl.
    const pois = [poi({ id: "a", status: "gesetzt" })];

    expect(plannablePois(pois)).toEqual(pois);
  });
});

describe("poiPlanCounts", () => {
  it("zaehlt einen unverplanten POI nicht", () => {
    expect(poiPlanCounts([]).get("a")).toBeUndefined();
  });

  it("zaehlt einen einmal verplanten POI mit 1", () => {
    const activities = [activity({ id: "act-1", poiId: "a" })];

    expect(poiPlanCounts(activities).get("a")).toBe(1);
  });

  it("zaehlt einen dreimal verplanten POI mit 3", () => {
    const activities = [
      activity({ id: "act-1", poiId: "a" }),
      activity({ id: "act-2", poiId: "a" }),
      activity({ id: "act-3", poiId: "a" }),
    ];

    expect(poiPlanCounts(activities).get("a")).toBe(3);
  });

  it("zaehlt ueber alle uebergebenen Programmpunkte, nicht nur einen Tag", () => {
    const activities = [
      activity({
        id: "act-1",
        poiId: "a",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T11:00",
      }),
      activity({
        id: "act-2",
        poiId: "a",
        startAt: "2026-07-20T10:00",
        endAt: "2026-07-20T11:00",
      }),
    ];

    expect(poiPlanCounts(activities).get("a")).toBe(2);
  });

  it("zaehlt mehrere POIs getrennt", () => {
    const activities = [
      activity({ id: "act-1", poiId: "a" }),
      activity({ id: "act-2", poiId: "b" }),
      activity({ id: "act-3", poiId: "b" }),
    ];

    const counts = poiPlanCounts(activities);
    expect(counts.get("a")).toBe(1);
    expect(counts.get("b")).toBe(2);
  });

  it("ignoriert Programmpunkte ohne POI", () => {
    const activities = [activity({ id: "act-1" })];

    expect(poiPlanCounts(activities).size).toBe(0);
  });
});

describe("isPlannablePoi", () => {
  it.each(["gesetzt", "wahrscheinlich"] as const)(
    'ist wahr fuer Status "%s"',
    (status) => {
      expect(isPlannablePoi({ status })).toBe(true);
    },
  );

  it.each(["weiss_nicht", "wenn_zeit", "auf_keinen_fall"] as const)(
    'ist falsch fuer Status "%s"',
    (status) => {
      expect(isPlannablePoi({ status })).toBe(false);
    },
  );
});
