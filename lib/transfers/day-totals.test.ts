import { describe, expect, it } from "vitest";
import { dayTransferTotals, formatDayTransferTotals } from "./day-totals";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "./types";

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

describe("dayTransferTotals", () => {
  it("summiert Distanz und Dauer der Transfers zwischen den Programmpunkten des Tages", () => {
    const activities = [
      activity({
        id: "a",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T11:00",
      }),
      activity({
        id: "b",
        startAt: "2026-07-18T11:30",
        endAt: "2026-07-18T12:00",
      }),
      activity({
        id: "c",
        startAt: "2026-07-18T13:00",
        endAt: "2026-07-18T14:00",
      }),
    ];
    const transfers = [
      transfer({
        id: "t1",
        fromActivityId: "a",
        toActivityId: "b",
        durationMin: 8,
        distanceKm: 0.4,
      }),
      transfer({
        id: "t2",
        fromActivityId: "b",
        toActivityId: "c",
        durationMin: 12,
        distanceKm: 4.2,
      }),
    ];

    const totals = dayTransferTotals(activities, transfers);
    expect(totals.distanceKm).toBeCloseTo(4.6);
    expect(totals.durationMin).toBe(20);
  });

  it("liefert Null-Summen ohne Transfers", () => {
    expect(dayTransferTotals([], [])).toEqual({
      distanceKm: 0,
      durationMin: 0,
    });
  });
});

describe("formatDayTransferTotals", () => {
  it('formatiert die Summen als "X km · Y Min Fahrzeit"', () => {
    expect(formatDayTransferTotals({ distanceKm: 4.6, durationMin: 20 })).toBe(
      "4,6 km · 20 Min Fahrzeit",
    );
  });
});
