import { describe, expect, it } from "vitest";
import { anzuzeigendeRunde } from "./rundenstand";
import type { Bewertungsrunde } from "./types";

/**
 * Der Stand einer ganzen Bewertungsrunde (req-063) -- ohne UI und ohne
 * Datenbank.
 */

function runde(overrides: Partial<Bewertungsrunde> = {}): Bewertungsrunde {
  return {
    id: "runde-1",
    tripId: "trip-1",
    status: "laeuft",
    poiIds: ["poi-1", "poi-2"],
    startedAt: "2026-09-07T10:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

describe("anzuzeigendeRunde (req-063)", () => {
  it("zeigt die laufende Runde", () => {
    const beendet = runde({
      id: "alt",
      status: "beendet",
      startedAt: "2026-09-08T10:00:00.000Z",
      endedAt: "2026-09-09T10:00:00.000Z",
    });

    expect(anzuzeigendeRunde([beendet, runde()])?.id).toBe("runde-1");
  });

  it("zeigt ohne laufende die zuletzt beendete", () => {
    const frueher = runde({
      id: "frueher",
      status: "beendet",
      startedAt: "2026-09-01T10:00:00.000Z",
      endedAt: "2026-09-02T10:00:00.000Z",
    });
    const spaeter = runde({
      id: "spaeter",
      status: "beendet",
      startedAt: "2026-09-03T10:00:00.000Z",
      endedAt: "2026-09-04T10:00:00.000Z",
    });

    expect(anzuzeigendeRunde([frueher, spaeter])?.id).toBe("spaeter");
    expect(anzuzeigendeRunde([spaeter, frueher])?.id).toBe("spaeter");
  });

  it("liefert nichts, wenn es noch nie eine Runde gab", () => {
    expect(anzuzeigendeRunde([])).toBeNull();
  });
});
