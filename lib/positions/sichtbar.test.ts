import { describe, expect, it } from "vitest";
import type { GeteiltePosition } from "./types";
import { sichtbarePositionen } from "./sichtbar";

const JETZT = new Date("2026-07-20T14:10:00.000Z");

function position(overrides: Partial<GeteiltePosition> = {}): GeteiltePosition {
  return {
    tripId: "reise-1",
    participantId: "person-1",
    lat: 40.611,
    lng: 14.69,
    ort: null,
    recordedAt: "2026-07-20T14:09:00.000Z",
    ...overrides,
  };
}

describe("sichtbarePositionen (req-050)", () => {
  it("behaelt eine 2 Minuten alte Position", () => {
    expect(sichtbarePositionen([position()], JETZT)).toEqual([position()]);
  });

  it("laesst eine 16 Minuten alte Position verschwinden", () => {
    const alt = position({ recordedAt: "2026-07-20T13:54:00.000Z" });

    expect(sichtbarePositionen([alt], JETZT)).toEqual([]);
  });

  it("behaelt eine genau 15 Minuten alte Position", () => {
    const grenzwertig = position({ recordedAt: "2026-07-20T13:55:00.000Z" });

    expect(sichtbarePositionen([grenzwertig], JETZT)).toEqual([grenzwertig]);
  });

  it("haelt mehrere Positionen auseinander", () => {
    const frisch = position({ participantId: "person-1" });
    const alt = position({
      participantId: "person-2",
      recordedAt: "2026-07-20T13:00:00.000Z",
    });

    expect(sichtbarePositionen([frisch, alt], JETZT)).toEqual([frisch]);
  });
});
