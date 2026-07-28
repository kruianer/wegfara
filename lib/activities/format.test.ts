import { describe, expect, it } from "vitest";
import { formatTimeRange } from "./format";

describe("formatTimeRange", () => {
  it('formatiert Beginn und Ende als "10:00 – 12:30"', () => {
    expect(
      formatTimeRange({
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T12:30",
      }),
    ).toBe("10:00 – 12:30");
  });

  it("formatiert auch ueber Mitternacht hinausreichende Zeitraeume", () => {
    expect(
      formatTimeRange({
        startAt: "2026-07-19T22:00",
        endAt: "2026-07-20T00:30",
      }),
    ).toBe("22:00 – 00:30");
  });
});
