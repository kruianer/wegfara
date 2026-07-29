import { describe, expect, it } from "vitest";
import { buildDayMap } from "./day-map";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Programmpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T11:00",
    position: { lat: 40.6, lng: 14.6 },
    ...overrides,
  };
}

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "t1",
    tripId: "trip-1",
    fromActivityId: "a1",
    toActivityId: "a2",
    mode: "auto",
    title: "Fahrt",
    durationMin: 10,
    distanceKm: 2,
    ...overrides,
  };
}

describe("buildDayMap", () => {
  it("erzeugt fuer vier Programmpunkte vier Marker", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T09:00",
        endAt: "2026-07-18T09:30",
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T10:30",
      }),
      activity({
        id: "a3",
        startAt: "2026-07-18T11:00",
        endAt: "2026-07-18T11:30",
      }),
      activity({
        id: "a4",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T12:30",
      }),
    ];

    const { markers } = buildDayMap(activities, []);

    expect(markers).toHaveLength(4);
  });

  it("nummeriert den zeitlich ersten Programmpunkt mit 1", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T09:00",
        endAt: "2026-07-18T09:30",
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T10:30",
      }),
    ];

    const { markers } = buildDayMap(activities, []);

    expect(markers[0]).toMatchObject({ number: 1, activity: activities[0] });
    expect(markers[1]).toMatchObject({ number: 2, activity: activities[1] });
  });

  it("zeigt fuer eine Options-Gruppe genau einen Marker mit der gewaehlten Alternative", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
        position: { lat: 1, lng: 1 },
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
        position: { lat: 2, lng: 2 },
      }),
      activity({
        id: "a3",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
        position: { lat: 3, lng: 3 },
      }),
    ];

    const { markers } = buildDayMap(activities, [], {
      "trip-1|2026-07-18T13:30|2026-07-18T15:00": "a2",
    });

    expect(markers).toHaveLength(1);
    expect(markers[0].activity.id).toBe("a2");
    expect(markers[0].isGroup).toBe(true);
  });

  it("waehlt ohne gespeicherte Auswahl die erste Alternative einer Options-Gruppe", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
      }),
    ];

    const { markers } = buildDayMap(activities, []);

    expect(markers).toHaveLength(1);
    expect(markers[0].activity.id).toBe("a1");
  });

  it("zeigt keinen Marker fuer einen Programmpunkt ohne Position", () => {
    const activities = [activity({ position: undefined })];

    const { markers } = buildDayMap(activities, []);

    expect(markers).toHaveLength(0);
  });

  it("verbindet zwei Programmpunkte mit hinterlegtem Transfer per Auto durchgezogen", () => {
    const activities = [
      activity({ id: "a1", position: { lat: 1, lng: 1 } }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
        position: { lat: 2, lng: 2 },
      }),
    ];
    const transfers = [transfer({ mode: "auto" })];

    const { lines } = buildDayMap(activities, transfers);

    expect(lines).toEqual([
      { mode: "auto", from: { lat: 1, lng: 1 }, to: { lat: 2, lng: 2 } },
    ]);
  });

  it("verbindet zwei Programmpunkte mit hinterlegtem Transfer zu Fuss gestrichelt", () => {
    const activities = [
      activity({ id: "a1", position: { lat: 1, lng: 1 } }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
        position: { lat: 2, lng: 2 },
      }),
    ];
    const transfers = [transfer({ mode: "fuss" })];

    const { lines } = buildDayMap(activities, transfers);

    expect(lines).toEqual([
      { mode: "fuss", from: { lat: 1, lng: 1 }, to: { lat: 2, lng: 2 } },
    ]);
  });

  it("zeichnet keine Linie zwischen zwei aufeinanderfolgenden Programmpunkten ohne Transfer", () => {
    const activities = [
      activity({ id: "a1" }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
      }),
    ];

    const { lines } = buildDayMap(activities, []);

    expect(lines).toHaveLength(0);
  });

  it("zeichnet keine Linie, wenn der Zielpunkt des Transfers keine Position hat", () => {
    const activities = [
      activity({ id: "a1", position: { lat: 1, lng: 1 } }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
        position: undefined,
      }),
    ];
    const transfers = [transfer()];

    const { lines } = buildDayMap(activities, transfers);

    expect(lines).toHaveLength(0);
  });

  it("liefert keine Marker fuer einen Reisetag ohne Programmpunkte", () => {
    const { markers, lines } = buildDayMap([], []);

    expect(markers).toHaveLength(0);
    expect(lines).toHaveLength(0);
  });
});
