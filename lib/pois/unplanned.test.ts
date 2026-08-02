import { describe, expect, it } from "vitest";
import { unplannedPois } from "./unplanned";
import type { Poi } from "./types";
import type { Activity } from "@/lib/activities/types";

function poi(overrides: Partial<Poi> & { id: string }): Poi {
  return {
    tripId: "trip-1",
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

describe("unplannedPois", () => {
  it("enthaelt einen gesetzten POI ohne verknuepften Programmpunkt", () => {
    const pois = [poi({ id: "a", status: "gesetzt" })];

    expect(unplannedPois(pois, [])).toEqual(pois);
  });

  it("enthaelt einen mit einem Programmpunkt verknuepften POI NICHT", () => {
    const pois = [poi({ id: "a", status: "gesetzt" })];
    const activities = [activity({ id: "act-1", poiId: "a" })];

    expect(unplannedPois(pois, activities)).toEqual([]);
  });

  it('enthaelt einen POI mit Status "Wahrscheinlich" ohne Verknuepfung', () => {
    const pois = [poi({ id: "a", status: "wahrscheinlich" })];

    expect(unplannedPois(pois, [])).toEqual(pois);
  });

  it.each(["weiss_nicht", "wenn_zeit", "auf_keinen_fall"] as const)(
    'enthaelt einen unverknuepften POI mit Status "%s" NICHT',
    (status) => {
      const pois = [poi({ id: "a", status })];

      expect(unplannedPois(pois, [])).toEqual([]);
    },
  );
});
