import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { reiseplanDruckPath } from "@/lib/druck/pfad";

/**
 * req-103: Der Plan ist ein Bereich des Planers geworden -- seine eigene
 * Adresse bleibt trotzdem bestehen, und beide zeigen dasselbe Geruest.
 *
 * Server-Komponenten lassen sich ohne Next nicht rendern; geprueft wird
 * deshalb an der Quelle (wie app/protected-pages.test.ts). Was das Geruest
 * zeigt, pruefen reiseplan-seite.test.tsx und reiseplan-druck.test.tsx.
 */
function quelle(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SEITE = "app/plan/reiseplan/[tripId]/page.tsx";

describe("Die eigene Adresse des Plans (req-103)", () => {
  it("bleibt unter /plan/reiseplan/<Reise> bestehen", () => {
    expect(reiseplanDruckPath("abc")).toBe("/plan/reiseplan/abc");
    expect(existsSync(path.join(process.cwd(), SEITE))).toBe(true);
  });

  it("zeigt dasselbe Geruest wie der Bereich Drucken -- keine zweite Fassung", () => {
    expect(quelle(SEITE)).toContain("<ReiseplanSeite");
    expect(quelle("app/plan/components/drucken-view.tsx")).toContain(
      "<ReiseplanSeite",
    );
  });

  it("bekommt Titelfoto, Transfers und Ueberschriften wie der Bereich", () => {
    const seite = quelle(SEITE);
    expect(seite).toContain("titelfoto={titelfoto}");
    expect(seite).toMatch(/transfers=\{transfers\.filter/);
    expect(seite).toContain("ueberschriften={ueberschriften}");
  });
});
