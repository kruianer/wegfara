import { describe, expect, it } from "vitest";
import {
  ACTIVE_PLAN_AREA,
  PLAN_AREAS,
  SWITCHABLE_PLAN_AREAS,
  mayUsePlanArea,
  planAreasFor,
} from "./areas";

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
      // Haengt an einer Kennzeichnung und steht deshalb hinten (req-038) --
      // wer sie nicht traegt, sieht den Bereich gar nicht.
      "Nutzer",
    ]);
  });

  it('kennt keinen Bereich "Gastzugänge" mehr (req-042)', () => {
    expect(PLAN_AREAS.some((area) => area.label === "Gastzugänge")).toBe(false);
    expect(SWITCHABLE_PLAN_AREAS).not.toContain("gastzugaenge");
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
      "nutzer",
    ]);
  });
});

describe("planAreasFor (req-038)", () => {
  it('zeigt "Nutzer" einem Bereichs-Admin', () => {
    const ids = planAreasFor({ accountAdmin: true }).map((area) => area.id);

    expect(ids).toContain("nutzer");
  });

  it('zeigt einem Teilnehmer ohne Kennzeichnung kein "Nutzer"', () => {
    const ids = planAreasFor({ accountAdmin: false }).map((area) => area.id);

    expect(ids).not.toContain("nutzer");
    // Die uebrigen Bereiche bleiben ihm erhalten.
    expect(ids).toContain("pois");
    expect(ids).toContain("account");
  });

  /**
   * Der Reiseleiter sah bis req-042 den Bereich "Gastzugaenge", auch ohne
   * Account-Admin zu sein. Mit dem Gastzugang ist der letzte Bereich
   * entfallen, den seine Rolle allein aufgeschlossen hat.
   */
  it("gibt dem Reiseleiter keinen Bereich mehr, den ein Teilnehmer nicht sieht (req-042)", () => {
    expect(planAreasFor({ accountAdmin: false })).toEqual(
      PLAN_AREAS.filter((area) => area.id !== "nutzer"),
    );
  });

  it("laesst die uebrigen Bereiche fuer jeden zu", () => {
    const niemand = { accountAdmin: false };

    expect(mayUsePlanArea("pois", niemand)).toBe(true);
    expect(mayUsePlanArea("account", niemand)).toBe(true);
    expect(mayUsePlanArea("nutzer", niemand)).toBe(false);
  });
});
