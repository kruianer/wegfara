import { describe, expect, it } from "vitest";
import {
  HOUR_HEIGHT_PX,
  computeBlockLayout,
  computeTimelineGrid,
  formatGridHourLabel,
} from "./timeline-grid";

describe("computeTimelineGrid (req-112: der ganze Tag)", () => {
  it("reicht ohne Programmpunkte von 00:00 bis 24:00", () => {
    expect(computeTimelineGrid([], "2026-07-20")).toEqual({
      startHour: 0,
      endHour: 24,
    });
  });

  it("reicht auch bei Programmpunkten mitten am Tag ueber den ganzen Tag", () => {
    const activities = [
      { startAt: "2026-07-18T10:00", endAt: "2026-07-18T12:30" },
      { startAt: "2026-07-18T17:00", endAt: "2026-07-18T18:00" },
    ];

    expect(computeTimelineGrid(activities, "2026-07-18")).toEqual({
      startHour: 0,
      endHour: 24,
    });
  });

  /**
   * Der Kern von req-112: Vorher begann das Raster bei 8 Uhr und wuchs erst,
   * wenn ein Punkt davor lag -- anlegen liess sich einer dort also nie.
   */
  it("zeigt die Nachtstunden, auch wenn dort nichts geplant ist", () => {
    const grid = computeTimelineGrid(
      [{ startAt: "2026-07-18T09:00", endAt: "2026-07-18T10:00" }],
      "2026-07-18",
    );

    expect(grid.startHour).toBe(0);
    expect(grid.endHour).toBe(24);
  });

  it("erweitert das Raster bis zur vollen Stunde nach einem Ende nach Mitternacht", () => {
    const activities = [
      { startAt: "2026-07-19T09:00", endAt: "2026-07-19T13:00" },
      { startAt: "2026-07-19T22:00", endAt: "2026-07-20T00:30" },
    ];

    expect(computeTimelineGrid(activities, "2026-07-19")).toEqual({
      startHour: 0,
      endHour: 25,
    });
  });

  it("haengt an ein Ende auf einer vollen Stunde keine Leerstunde an", () => {
    const activities = [
      { startAt: "2026-07-19T23:00", endAt: "2026-07-20T01:00" },
    ];

    expect(computeTimelineGrid(activities, "2026-07-19")).toEqual({
      startHour: 0,
      endHour: 25,
    });
  });

  it("beginnt auch bei einem fruehen Programmpunkt bei 00:00", () => {
    const activities = [
      { startAt: "2026-07-18T05:30", endAt: "2026-07-18T06:30" },
    ];

    expect(computeTimelineGrid(activities, "2026-07-18")).toEqual({
      startHour: 0,
      endHour: 24,
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
