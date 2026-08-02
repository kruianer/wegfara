import { describe, expect, it } from "vitest";
import {
  HOUR_HEIGHT_PX,
  computeBlockLayout,
  computeTimelineGrid,
  formatGridHourLabel,
} from "./timeline-grid";

describe("computeTimelineGrid", () => {
  it("reicht ohne Programmpunkte von 08:00 bis 22:00", () => {
    expect(computeTimelineGrid([], "2026-07-20")).toEqual({
      startHour: 8,
      endHour: 22,
    });
  });

  it("bleibt bei Programmpunkten innerhalb 08:00-22:00 beim Mindestbereich", () => {
    const activities = [
      { startAt: "2026-07-18T10:00", endAt: "2026-07-18T12:30" },
      { startAt: "2026-07-18T17:00", endAt: "2026-07-18T18:00" },
    ];

    expect(computeTimelineGrid(activities, "2026-07-18")).toEqual({
      startHour: 8,
      endHour: 22,
    });
  });

  it("erweitert das Raster bis zur vollen Stunde nach einem Ende nach Mitternacht", () => {
    const activities = [
      { startAt: "2026-07-19T09:00", endAt: "2026-07-19T13:00" },
      { startAt: "2026-07-19T22:00", endAt: "2026-07-20T00:30" },
    ];

    expect(computeTimelineGrid(activities, "2026-07-19")).toEqual({
      startHour: 8,
      endHour: 25,
    });
  });

  it("erweitert das Raster vor einen fruehen Beginn", () => {
    const activities = [
      { startAt: "2026-07-18T05:30", endAt: "2026-07-18T06:30" },
    ];

    expect(computeTimelineGrid(activities, "2026-07-18")).toEqual({
      startHour: 5,
      endHour: 22,
    });
  });
});

describe("formatGridHourLabel", () => {
  it("formatiert eine Stunde innerhalb des Tages", () => {
    expect(formatGridHourLabel(9)).toBe("09:00");
  });

  it("formatiert eine Stunde jenseits von Mitternacht", () => {
    expect(formatGridHourLabel(25)).toBe("01:00");
  });
});

describe("computeBlockLayout", () => {
  it("berechnet Lage und Hoehe eines Programmpunkts von 10:00 bis 12:30", () => {
    const grid = { startHour: 8, endHour: 22 };
    const layout = computeBlockLayout(
      { startAt: "2026-07-18T10:00", endAt: "2026-07-18T12:30" },
      grid,
      "2026-07-18",
    );

    expect(layout.topPx).toBe((10 - 8) * HOUR_HEIGHT_PX);
    expect(layout.heightPx).toBe(2.5 * HOUR_HEIGHT_PX);
  });

  it("berechnet die Hoehe ueber Mitternacht hinaus korrekt", () => {
    const grid = { startHour: 8, endHour: 25 };
    const layout = computeBlockLayout(
      { startAt: "2026-07-19T22:00", endAt: "2026-07-20T00:30" },
      grid,
      "2026-07-19",
    );

    expect(layout.topPx).toBe((22 - 8) * HOUR_HEIGHT_PX);
    expect(layout.heightPx).toBe(2.5 * HOUR_HEIGHT_PX);
  });
});
