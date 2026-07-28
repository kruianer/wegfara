import { describe, expect, it } from "vitest";
import { activitiesForDay } from "./day";
import type { Activity } from "./types";

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: "trip-1",
    type: "aktivitaet",
    title: "Programmpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T11:00",
    position: { lat: 0, lng: 0 },
    ...overrides,
  };
}

describe("activitiesForDay", () => {
  it("liefert nur die Programmpunkte der gewaehlten Reise und des gewaehlten Tages", () => {
    const activities = [
      activity({ id: "a", tripId: "trip-1", startAt: "2026-07-18T10:00" }),
      activity({ id: "b", tripId: "trip-2", startAt: "2026-07-18T09:00" }),
      activity({ id: "c", tripId: "trip-1", startAt: "2026-07-19T09:00" }),
    ];

    const result = activitiesForDay(activities, "trip-1", "2026-07-18");

    expect(result.map((a) => a.id)).toEqual(["a"]);
  });

  it("sortiert aufsteigend nach Beginnzeit", () => {
    const activities = [
      activity({ id: "spaet", startAt: "2026-07-18T15:00" }),
      activity({ id: "frueh", startAt: "2026-07-18T09:00" }),
      activity({ id: "mitte", startAt: "2026-07-18T12:00" }),
    ];

    const result = activitiesForDay(activities, "trip-1", "2026-07-18");

    expect(result.map((a) => a.id)).toEqual(["frueh", "mitte", "spaet"]);
  });

  it("ordnet einen Programmpunkt dem Tag zu, an dem er beginnt, auch wenn er ueber Mitternacht hinausreicht", () => {
    const activities = [
      activity({
        id: "nacht",
        startAt: "2026-07-19T22:00",
        endAt: "2026-07-20T00:30",
      }),
    ];

    expect(
      activitiesForDay(activities, "trip-1", "2026-07-19").map((a) => a.id),
    ).toEqual(["nacht"]);
    expect(
      activitiesForDay(activities, "trip-1", "2026-07-20").map((a) => a.id),
    ).toEqual([]);
  });

  it("liefert eine leere Liste fuer einen Tag ohne Programmpunkte", () => {
    expect(activitiesForDay([], "trip-1", "2026-07-20")).toEqual([]);
  });
});
