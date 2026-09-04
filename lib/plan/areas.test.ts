import { describe, expect, it } from "vitest";
import { ACTIVE_PLAN_AREA, PLAN_AREAS, SWITCHABLE_PLAN_AREAS } from "./areas";

describe("PLAN_AREAS", () => {
  it('enthaelt die vorgegebenen Bereiche, "Mein Bereich" zuletzt (req-032)', () => {
    expect(PLAN_AREAS.map((area) => area.label)).toEqual([
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Reisedetails",
      "Mein Bereich",
    ]);
  });

  it('nennt den eigenen Bereich "Mein Bereich" statt "Account" (req-036)', () => {
    expect(PLAN_AREAS.find((area) => area.id === "account")?.label).toBe(
      "Mein Bereich",
    );
    // Die Kennung bleibt "account" -- umbenannt wurde nur die Beschriftung.
    expect(PLAN_AREAS.some((area) => area.label.includes("Account"))).toBe(
      false,
    );
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

  it('enthaelt "pois", "planung", "dokumente", "reisedetails" und "account" als bedienbare Bereiche (siehe req-011, req-019, req-032, req-033, req-034)', () => {
    expect(SWITCHABLE_PLAN_AREAS).toEqual([
      "pois",
      "planung",
      "dokumente",
      "reisedetails",
      "account",
    ]);
  });
});
