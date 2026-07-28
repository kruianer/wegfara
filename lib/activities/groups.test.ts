import { describe, expect, it } from "vitest";
import { groupActivities, groupKey } from "./groups";
import type { Activity } from "./types";

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: "trip-1",
    type: "aktivitaet",
    title: "Programmpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-20T13:30",
    endAt: "2026-07-20T15:00",
    position: { lat: 0, lng: 0 },
    ...overrides,
  };
}

describe("groupActivities", () => {
  it("fasst drei Programmpunkte mit exakt gleichem Beginn und Ende zu einer Gruppe zusammen", () => {
    const activities = [
      activity({ id: "a" }),
      activity({ id: "b" }),
      activity({ id: "c" }),
    ];

    const entries = groupActivities(activities);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "group" });
    if (entries[0].kind === "group") {
      expect(entries[0].group.activities.map((a) => a.id)).toEqual([
        "a",
        "b",
        "c",
      ]);
    }
  });

  it("gruppiert Programmpunkte NICHT, wenn nur der Beginn uebereinstimmt, aber nicht das Ende", () => {
    const activities = [
      activity({
        id: "kurz",
        startAt: "2026-07-20T18:00",
        endAt: "2026-07-20T18:30",
      }),
      activity({
        id: "lang",
        startAt: "2026-07-20T18:00",
        endAt: "2026-07-20T20:00",
      }),
    ];

    const entries = groupActivities(activities);

    expect(entries).toEqual([
      { kind: "single", activity: activities[0] },
      { kind: "single", activity: activities[1] },
    ]);
  });

  it("gruppiert Programmpunkte NICHT, wenn Beginn und Ende zwar zur selben Uhrzeit passen, aber an unterschiedlichen Tagen liegen", () => {
    const activities = [
      activity({
        id: "tag1",
        startAt: "2026-07-20T13:30",
        endAt: "2026-07-20T15:00",
      }),
      activity({
        id: "tag2",
        startAt: "2026-07-21T13:30",
        endAt: "2026-07-21T15:00",
      }),
    ];

    const entries = groupActivities(activities);

    expect(entries).toEqual([
      { kind: "single", activity: activities[0] },
      { kind: "single", activity: activities[1] },
    ]);
  });

  it("gruppiert Programmpunkte NICHT, wenn Beginn und Ende zwar uebereinstimmen, aber die Reise unterschiedlich ist", () => {
    const activities = [
      activity({ id: "a", tripId: "trip-1" }),
      activity({ id: "b", tripId: "trip-2" }),
    ];

    const entries = groupActivities(activities);

    expect(entries).toEqual([
      { kind: "single", activity: activities[0] },
      { kind: "single", activity: activities[1] },
    ]);
  });

  it("belaesst einzelne Programmpunkte ohne Uebereinstimmung als Einzeleintraege", () => {
    const activities = [
      activity({
        id: "a",
        startAt: "2026-07-20T10:00",
        endAt: "2026-07-20T11:00",
      }),
      activity({
        id: "b",
        startAt: "2026-07-20T12:00",
        endAt: "2026-07-20T13:00",
      }),
    ];

    const entries = groupActivities(activities);

    expect(entries).toEqual([
      { kind: "single", activity: activities[0] },
      { kind: "single", activity: activities[1] },
    ]);
  });

  it("ordnet die Gruppe an die Stelle der ersten Fundstelle im Zeitstrahl ein", () => {
    const activities = [
      activity({
        id: "frueh",
        startAt: "2026-07-20T09:00",
        endAt: "2026-07-20T10:00",
      }),
      activity({
        id: "opt-a",
        startAt: "2026-07-20T13:30",
        endAt: "2026-07-20T15:00",
      }),
      activity({
        id: "opt-b",
        startAt: "2026-07-20T13:30",
        endAt: "2026-07-20T15:00",
      }),
      activity({
        id: "spaet",
        startAt: "2026-07-20T16:00",
        endAt: "2026-07-20T17:00",
      }),
    ];

    const entries = groupActivities(activities);

    expect(entries.map((e) => e.kind)).toEqual(["single", "group", "single"]);
  });
});

describe("groupKey", () => {
  it("liefert fuer dieselbe Reise, Beginn und Ende denselben Schluessel", () => {
    const a = {
      tripId: "trip-1",
      startAt: "2026-07-20T13:30",
      endAt: "2026-07-20T15:00",
    };
    const b = {
      tripId: "trip-1",
      startAt: "2026-07-20T13:30",
      endAt: "2026-07-20T15:00",
    };

    expect(groupKey(a)).toEqual(groupKey(b));
  });

  it("liefert fuer unterschiedliche Reisen unterschiedliche Schluessel", () => {
    const a = {
      tripId: "trip-1",
      startAt: "2026-07-20T13:30",
      endAt: "2026-07-20T15:00",
    };
    const b = {
      tripId: "trip-2",
      startAt: "2026-07-20T13:30",
      endAt: "2026-07-20T15:00",
    };

    expect(groupKey(a)).not.toEqual(groupKey(b));
  });
});
