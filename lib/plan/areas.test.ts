import { describe, expect, it } from "vitest";
import { ACTIVE_PLAN_AREA, PLAN_AREAS, SWITCHABLE_PLAN_AREAS } from "./areas";

describe("PLAN_AREAS", () => {
  it("enthaelt genau die sechs Bereiche der geoeffneten Reise (req-009)", () => {
    expect(PLAN_AREAS.map((area) => area.label)).toEqual([
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Reisedetails",
    ]);
  });

  /**
   * "Konto", "Account" und "Nutzer" sind mit req-043 zu "Mein Bereich"
   * zusammengelegt -- einer eigenen Seite, die aus dem Planer wie aus dem
   * Begleiter erreichbar ist. Als Bereich des Planers gibt es sie nicht
   * mehr.
   */
  it('kennt weder "Account" noch "Nutzer" als Bereich (req-043)', () => {
    const ids = PLAN_AREAS.map((area) => area.id as string);

    expect(ids).not.toContain("account");
    expect(ids).not.toContain("nutzer");
    expect(SWITCHABLE_PLAN_AREAS as string[]).not.toContain("account");
    expect(SWITCHABLE_PLAN_AREAS as string[]).not.toContain("nutzer");
  });

  it('kennt keinen Bereich "Gastzugänge" mehr (req-042)', () => {
    expect(PLAN_AREAS.some((area) => area.label === "Gastzugänge")).toBe(false);
    expect(SWITCHABLE_PLAN_AREAS as string[]).not.toContain("gastzugaenge");
  });

  it('nennt den Bereich der geoeffneten Reise "Reisedetails" (req-033)', () => {
    expect(PLAN_AREAS.find((area) => area.id === "reisedetails")?.label).toBe(
      "Reisedetails",
    );
    expect(PLAN_AREAS.some((area) => area.label === "Einstellungen")).toBe(
      false,
    );
  });

  it("hat fuer jeden Bereich eine eindeutige id", () => {
    const ids = PLAN_AREAS.map((area) => area.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('setzt "pois" als aktiven Bereich', () => {
    expect(ACTIVE_PLAN_AREA).toBe("pois");
    expect(PLAN_AREAS.some((area) => area.id === ACTIVE_PLAN_AREA)).toBe(true);
  });

  it('enthaelt "pois", "planung", "dokumente" und "reisedetails" als bedienbare Bereiche (siehe req-011, req-019, req-033, req-034)', () => {
    expect(SWITCHABLE_PLAN_AREAS).toEqual([
      "pois",
      "planung",
      "dokumente",
      "reisedetails",
    ]);
  });
});
