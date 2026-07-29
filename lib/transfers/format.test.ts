import { describe, expect, it } from "vitest";
import { formatTransferMeta } from "./format";

describe("formatTransferMeta", () => {
  it('formatiert Dauer und Distanz als "12 Min · 4,2 km"', () => {
    expect(formatTransferMeta({ durationMin: 12, distanceKm: 4.2 })).toBe(
      "12 Min · 4,2 km",
    );
  });

  it("rundet die Distanz auf eine Nachkommastelle", () => {
    expect(formatTransferMeta({ durationMin: 5, distanceKm: 0.35 })).toBe(
      "5 Min · 0,3 km",
    );
  });
});
