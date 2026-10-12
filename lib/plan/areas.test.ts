import { describe, expect, it } from "vitest";
import { PLANER_PATH } from "../einstieg/ziel";
import {
  ACTIVE_PLAN_AREA,
  PLAN_AREAS,
  SWITCHABLE_PLAN_AREAS,
  isSwitchablePlanArea,
  planAreaFromParam,
  planAreaPath,
} from "./areas";

describe("PLAN_AREAS", () => {
  it("enthaelt die Bereiche der geoeffneten Reise (req-009, req-081)", () => {
    expect(PLAN_AREAS.map((area) => area.label)).toEqual([
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Reisedetails",
      "Chat",
    ]);
  });

  /** Der Ort, an dem man mit der App redet (req-081). */
  it('fuehrt den Bereich "Chat" (req-081)', () => {
    expect(PLAN_AREAS.find((area) => area.id === "chat")?.label).toBe("Chat");
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

  it("hat seit req-063 die sechs gewachsenen Bereiche bedienbar (siehe req-011, req-019, req-033, req-034, req-062)", () => {
    expect(SWITCHABLE_PLAN_AREAS).toEqual([
      "pois",
      "planung",
      "bewertungen",
      "kosten",
      "dokumente",
      "reisedetails",
    ]);
  });

  /**
   * Der "Chat" steht in der Leiste, bevor es ihn gibt (bug-033) -- sichtbar,
   * aber abgeschaltet. Mit dem Chatfenster kommt er hier dazu.
   */
  it('zeigt "Chat" noch abgeschaltet (req-081)', () => {
    expect(SWITCHABLE_PLAN_AREAS as string[]).not.toContain("chat");
    expect(isSwitchablePlanArea("chat")).toBe(false);
    expect(planAreaFromParam("chat")).toBeNull();
  });
});

/**
 * Die Bereichsleiste steht seit bug-033 auch ausserhalb des Planers. Von
 * dort fuehrt sie an eine Adresse statt in einen Zustand -- der Planer muss
 * den gemeinten Bereich aus ihr lesen koennen.
 */
describe("Bereich in der Adresse des Planers (bug-033)", () => {
  it("haengt den Bereich an die Adresse des Planers", () => {
    expect(planAreaPath("planung")).toBe(`${PLANER_PATH}?bereich=planung`);
    expect(planAreaPath("pois")).toBe(`${PLANER_PATH}?bereich=pois`);
  });

  it("liest ihn wieder heraus", () => {
    for (const area of SWITCHABLE_PLAN_AREAS) {
      expect(planAreaFromParam(area)).toBe(area);
    }
  });

  it("nimmt den ersten, wenn er mehrfach in der Adresse steht", () => {
    expect(planAreaFromParam(["dokumente", "pois"])).toBe("dokumente");
  });

  it("nimmt nichts Unbekanntes an", () => {
    expect(planAreaFromParam(undefined)).toBeNull();
    expect(planAreaFromParam("")).toBeNull();
    expect(planAreaFromParam("gibt-es-nicht")).toBeNull();
  });

  it("oeffnet keinen Bereich, den es nicht gibt", () => {
    expect(planAreaFromParam("gastzugaenge")).toBeNull();
  });

  it("oeffnet den Bereich Kosten, seit es ihn gibt (req-062)", () => {
    expect(planAreaFromParam("kosten")).toBe("kosten");
  });

  it("oeffnet den Bereich Bewertungen, seit es ihn gibt (req-063)", () => {
    expect(planAreaFromParam("bewertungen")).toBe("bewertungen");
  });

  it("sagt, welcher Bereich schon gebaut ist", () => {
    expect(isSwitchablePlanArea("pois")).toBe(true);
    expect(isSwitchablePlanArea("kosten")).toBe(true);
    expect(isSwitchablePlanArea("bewertungen")).toBe(true);
  });
});
