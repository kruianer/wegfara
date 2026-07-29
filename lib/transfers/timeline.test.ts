import { describe, expect, it } from "vitest";
import { groupActivities } from "@/lib/activities/groups";
import type { Activity } from "@/lib/activities/types";
import { insertTransfers } from "./timeline";
import type { Transfer } from "./types";

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: "trip-1",
    type: "aktivitaet",
    title: "Programmpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-20T10:00",
    endAt: "2026-07-20T11:00",
    position: { lat: 0, lng: 0 },
    ...overrides,
  };
}

function transfer(overrides: Partial<Transfer> & { id: string }): Transfer {
  return {
    tripId: "trip-1",
    fromActivityId: "a",
    toActivityId: "b",
    mode: "auto",
    title: "Transfer",
    durationMin: 10,
    distanceKm: 1,
    ...overrides,
  };
}

describe("insertTransfers", () => {
  it("fuegt einen Transfer zwischen den beiden Programmpunkten ein, die er verbindet", () => {
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
    const t = transfer({ id: "t1", fromActivityId: "a", toActivityId: "b" });

    const entries = insertTransfers(
      groupActivities(activities),
      [t],
      activities,
    );

    expect(entries.map((e) => e.kind)).toEqual([
      "single",
      "transfer",
      "single",
    ]);
  });

  it("laesst zwei aufeinanderfolgende Programmpunkte ohne Transfer dazwischen unveraendert", () => {
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

    const entries = insertTransfers(
      groupActivities(activities),
      [],
      activities,
    );

    expect(entries.map((e) => e.kind)).toEqual(["single", "single"]);
  });

  it("uebernimmt den Zielpunkt des Transfers fuer die Route-Navigation", () => {
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
        position: { lat: 40.6, lng: 14.6 },
      }),
    ];
    const t = transfer({ id: "t1", fromActivityId: "a", toActivityId: "b" });

    const entries = insertTransfers(
      groupActivities(activities),
      [t],
      activities,
    );

    const transferEntry = entries.find((e) => e.kind === "transfer");
    expect(transferEntry).toMatchObject({
      toActivity: { id: "b", position: { lat: 40.6, lng: 14.6 } },
    });
  });

  it("ignoriert einen Transfer, dessen Endpunkte nicht benachbart im Tag liegen", () => {
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
      activity({
        id: "c",
        startAt: "2026-07-20T14:00",
        endAt: "2026-07-20T15:00",
      }),
    ];
    const t = transfer({ id: "t1", fromActivityId: "a", toActivityId: "c" });

    const entries = insertTransfers(
      groupActivities(activities),
      [t],
      activities,
    );

    expect(entries.map((e) => e.kind)).toEqual(["single", "single", "single"]);
  });

  it("findet einen Transfer, dessen Endpunkt Teil einer Options-Gruppe ist", () => {
    const activities = [
      activity({
        id: "a",
        startAt: "2026-07-20T10:00",
        endAt: "2026-07-20T11:00",
      }),
      activity({
        id: "opt1",
        startAt: "2026-07-20T13:30",
        endAt: "2026-07-20T15:00",
      }),
      activity({
        id: "opt2",
        startAt: "2026-07-20T13:30",
        endAt: "2026-07-20T15:00",
      }),
    ];
    const t = transfer({ id: "t1", fromActivityId: "a", toActivityId: "opt2" });

    const entries = insertTransfers(
      groupActivities(activities),
      [t],
      activities,
    );

    expect(entries.map((e) => e.kind)).toEqual(["single", "transfer", "group"]);
  });
});
