// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRIP_STATE,
  TRIP_STATES,
  TRIP_STATE_LABEL,
  isTripState,
} from "./state";
import { tripStatus } from "./status";

describe("Zustand einer Reise (req-022)", () => {
  it("kennt genau drei Zustaende", () => {
    expect(TRIP_STATES).toEqual(["in_planung", "freigegeben", "abgeschlossen"]);
  });

  it("benennt sie so, wie sie in der Oberflaeche stehen", () => {
    expect(TRIP_STATES.map((state) => TRIP_STATE_LABEL[state])).toEqual([
      "In Planung",
      "Freigegeben",
      "Abgeschlossen",
    ]);
  });

  it('steht bei einer neuen Reise auf "In Planung"', () => {
    expect(DEFAULT_TRIP_STATE).toBe("in_planung");
  });

  it("nimmt nur die drei vorgegebenen Werte an", () => {
    expect(isTripState("freigegeben")).toBe(true);
    expect(isTripState("abgeschlossen")).toBe(true);
    expect(isTripState("archiviert")).toBe(false);
    expect(isTripState("aktiv")).toBe(false);
    expect(isTripState(null)).toBe(false);
    expect(isTripState(2)).toBe(false);
  });

  it("ist unabhaengig vom Zeitstatus -- eine laufende Reise darf in Planung stehen", () => {
    const suedItalien = { startDate: "2026-07-18", endDate: "2026-07-23" };

    // Der Zeitstatus bleibt eine reine Rechnung auf dem Zeitraum und kennt
    // den gesetzten Zustand nicht (req-022, Constraints).
    expect(tripStatus(suedItalien, new Date(2026, 6, 20))).toBe("aktiv");
    expect(isTripState("aktiv")).toBe(false);
  });
});
