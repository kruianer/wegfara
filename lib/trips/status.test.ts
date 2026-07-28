// @vitest-environment node
import { describe, expect, it } from "vitest";
import { tripStatus } from "./status";

const suedItalien = { startDate: "2026-07-18", endDate: "2026-07-23" };

describe("tripStatus", () => {
  it('ist "aktiv", wenn heute innerhalb des Zeitraums liegt', () => {
    expect(tripStatus(suedItalien, new Date(2026, 6, 20))).toBe("aktiv");
  });

  it('ist "aktiv" am ersten Tag des Zeitraums', () => {
    expect(tripStatus(suedItalien, new Date(2026, 6, 18))).toBe("aktiv");
  });

  it('ist "aktiv" am letzten Tag des Zeitraums', () => {
    expect(tripStatus(suedItalien, new Date(2026, 6, 23))).toBe("aktiv");
  });

  it('ist "geplant", wenn heute vor dem Zeitraum liegt', () => {
    expect(
      tripStatus(
        { startDate: "2026-10-09", endDate: "2026-10-11" },
        new Date(2026, 6, 20),
      ),
    ).toBe("geplant");
  });

  it('ist "beendet", wenn heute nach dem Zeitraum liegt', () => {
    expect(
      tripStatus(
        { startDate: "2026-05-25", endDate: "2026-05-31" },
        new Date(2026, 6, 20),
      ),
    ).toBe("beendet");
  });
});
