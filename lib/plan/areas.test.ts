import { describe, expect, it } from "vitest";
import { ACTIVE_PLAN_AREA, PLAN_AREAS, SWITCHABLE_PLAN_AREAS } from "./areas";

describe("PLAN_AREAS", () => {
  it("enthaelt die vorgegebenen Bereiche, den Bereich Account zuletzt (req-032)", () => {
    expect(PLAN_AREAS.map((area) => area.label)).toEqual([
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Einstellungen",
      "Account",
    ]);
  });

  it("hat fuer jeden Bereich eine eindeutige id", () => {
    const ids = PLAN_AREAS.map((area) => area.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('setzt "pois" als aktiven Bereich', () => {
    expect(ACTIVE_PLAN_AREA).toBe("pois");
    expect(PLAN_AREAS.some((area) => area.id === ACTIVE_PLAN_AREA)).toBe(true);
  });

  it('enthaelt "pois", "planung", "einstellungen" und "account" als bedienbare Bereiche (siehe req-011, req-019, req-032)', () => {
    expect(SWITCHABLE_PLAN_AREAS).toEqual([
      "pois",
      "planung",
      "einstellungen",
      "account",
    ]);
  });
});
