import { describe, expect, it } from "vitest";
import {
  formatReiseLaenge,
  langeReiseHinweis,
  reiseLaengeInTagen,
  UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN,
} from "./laenge";
import { tripDays } from "./days";

/**
 * Der Fall aus bug-050: auf prod entstand aus einer Reise ueber zwei Tage
 * eine ueber 367 -- beim Ende war im Kalender des iPads die Jahreszahl
 * mitgerutscht. Gerechnet hatte der Planer richtig; gemerkt hatte es nur
 * niemand.
 */
describe("reiseLaengeInTagen (bug-050)", () => {
  it("zaehlt den An- und den Abreisetag mit", () => {
    expect(reiseLaengeInTagen("2026-10-25", "2026-10-26")).toBe(2);
  });

  it("zaehlt eine Reise an einem einzigen Tag als einen Tag", () => {
    expect(reiseLaengeInTagen("2026-10-25", "2026-10-25")).toBe(1);
  });

  it("ergibt fuer das verrutschte Jahr aus bug-050 367 Tage", () => {
    expect(reiseLaengeInTagen("2026-10-25", "2027-10-26")).toBe(367);
  });

  it("zaehlt genauso viele Tage, wie der Planer als Reisetage zeigt", () => {
    const zeitraum = { startDate: "2026-10-25", endDate: "2027-10-26" };

    expect(reiseLaengeInTagen(zeitraum.startDate, zeitraum.endDate)).toBe(
      tripDays(zeitraum).length,
    );
  });

  it("uebersteht den Wechsel der Sommerzeit (vgl. bug-004)", () => {
    // Die Umstellung liegt in dieser Woche -- ueber die Ortszeit gerechnet
    // waeren es 6,96 oder 7,04 Tage.
    expect(reiseLaengeInTagen("2027-03-26", "2027-04-01")).toBe(7);
    expect(reiseLaengeInTagen("2027-10-29", "2027-11-04")).toBe(7);
  });

  it("hat ohne vollstaendige Daten keine Laenge", () => {
    expect(reiseLaengeInTagen("", "2026-10-26")).toBe(0);
    expect(reiseLaengeInTagen("2026-10-25", "")).toBe(0);
    expect(reiseLaengeInTagen("2026-10-2", "2026-10-26")).toBe(0);
    expect(reiseLaengeInTagen("2026-02-30", "2026-10-26")).toBe(0);
  });

  it("hat keine Laenge, wenn das Ende vor dem Beginn liegt", () => {
    expect(reiseLaengeInTagen("2027-05-12", "2027-05-05")).toBe(0);
  });
});

describe("formatReiseLaenge (bug-050)", () => {
  it("nennt einen einzelnen Tag in der Einzahl", () => {
    expect(formatReiseLaenge(1)).toBe("1 Tag");
  });

  it("nennt mehrere Tage in der Mehrzahl", () => {
    expect(formatReiseLaenge(2)).toBe("2 Tage");
    expect(formatReiseLaenge(367)).toBe("367 Tage");
  });
});

/**
 * Der Hinweis entscheidet, ob eine Reise noch stillschweigend durchgeht
 * (bug-050). Die Grenze ist grosszuegig: sie faengt das verrutschte Jahr ab,
 * verbietet aber keine lange Reise.
 */
describe("langeReiseHinweis (bug-050)", () => {
  it("laesst eine Reise ueber zwei Tage ohne Hinweis durch", () => {
    expect(langeReiseHinweis("2026-10-25", "2026-10-26")).toBeNull();
  });

  it(`laesst ${UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN - 1} Tage ohne Hinweis durch`, () => {
    // 2026-10-25 plus 58 Tage: der letzte Zeitraum, der unauffaellig ist.
    const zeitraum = { startDate: "2026-10-25", endDate: "2026-12-22" };
    expect(reiseLaengeInTagen(zeitraum.startDate, zeitraum.endDate)).toBe(
      UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN - 1,
    );

    expect(langeReiseHinweis(zeitraum.startDate, zeitraum.endDate)).toBeNull();
  });

  it(`weist bei ${UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN} Tagen darauf hin`, () => {
    const zeitraum = { startDate: "2026-10-25", endDate: "2026-12-23" };
    expect(reiseLaengeInTagen(zeitraum.startDate, zeitraum.endDate)).toBe(
      UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN,
    );

    expect(langeReiseHinweis(zeitraum.startDate, zeitraum.endDate)).toContain(
      "60 Tage",
    );
  });

  it("nennt beim Fall aus bug-050 die 367 Tage und die Jahreszahl", () => {
    const hinweis = langeReiseHinweis("2026-10-25", "2027-10-26");

    expect(hinweis).toContain("367 Tage");
    expect(hinweis).toContain("Jahreszahl");
  });

  it("weist auf ein Ende vor dem Beginn nicht hin -- das prueft validate.ts", () => {
    expect(langeReiseHinweis("2027-05-12", "2027-05-05")).toBeNull();
  });

  it("weist auf unvollstaendige Daten nicht hin", () => {
    expect(langeReiseHinweis("2026-10-25", "")).toBeNull();
  });
});
