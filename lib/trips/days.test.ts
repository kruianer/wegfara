// @vitest-environment node
import { describe, expect, it } from "vitest";
import { tripDays } from "./days";

describe("tripDays", () => {
  it("erzeugt genau einen Eintrag je Tag, inklusive An- und Abreisetag", () => {
    const days = tripDays({ startDate: "2026-10-09", endDate: "2026-10-11" });
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });

  it("liefert genau drei Eintraege fuer die Wien-Reise (09.-11.10.2026)", () => {
    expect(
      tripDays({ startDate: "2026-10-09", endDate: "2026-10-11" }),
    ).toHaveLength(3);
  });

  it("berechnet den korrekten Wochentag", () => {
    const days = tripDays({ startDate: "2026-07-18", endDate: "2026-07-23" });
    expect(days.map((d) => d.weekday)).toEqual([
      "Sa",
      "So",
      "Mo",
      "Di",
      "Mi",
      "Do",
    ]);
  });

  it("funktioniert ueber einen Monatswechsel hinweg", () => {
    const days = tripDays({ startDate: "2026-07-30", endDate: "2026-08-02" });
    expect(days.map((d) => d.date)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });
});
