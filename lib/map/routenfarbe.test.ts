import { describe, expect, it } from "vitest";
import { kontrastVerhaeltnis, leuchtdichte } from "@/lib/design/kontrast";
import {
  KARTENGRUND_HELL,
  MINDESTKONTRAST_ROUTE,
  ROUTEN_FARBE,
} from "./routenfarbe";

/**
 * Die Richtungspfeile und die Verbindungslinie der Tageskarte lagen in der
 * Sandfarbe des Planer-Akzents (#d9c589) auf dem hellen Kartengrund und waren
 * dort mit 1,49:1 praktisch nicht zu sehen (bug-059).
 */
describe("ROUTEN_FARBE -- Pfeile und Linien auf der hellen Karte (bug-059)", () => {
  /** Die Flaechen der OpenStreetMap-Kacheln, auf denen ein Weg liegen kann. */
  const KARTENFLAECHEN = {
    Grundton: KARTENGRUND_HELL,
    Wasser: "#aad3df",
    Wald: "#cdebb0",
    Bebauung: "#d9d0c9",
    Strasse: "#ffffff",
  };

  it("ist ein Farbwert in Hex-Schreibweise", () => {
    expect(ROUTEN_FARBE).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("ist nicht mehr der Sandton des Planer-Akzents", () => {
    expect(ROUTEN_FARBE).not.toBe("#d9c589");
  });

  it("ist ein dunkler Ton -- die Karte darunter ist hell", () => {
    expect(leuchtdichte(ROUTEN_FARBE)).toBeLessThan(
      leuchtdichte(KARTENGRUND_HELL),
    );
  });

  for (const [name, flaeche] of Object.entries(KARTENFLAECHEN)) {
    it(`hebt sich auf ${name} ueber ${MINDESTKONTRAST_ROUTE}:1 ab`, () => {
      expect(kontrastVerhaeltnis(ROUTEN_FARBE, flaeche)).toBeGreaterThanOrEqual(
        MINDESTKONTRAST_ROUTE,
      );
    });
  }

  it("holt auf dem Kartengrund deutlich mehr als die Grenze", () => {
    // "besser mehr", denn unter den Pfeilen liegen Beschriftungen und Wege
    // der Karte (bug-059, Erwartete Behebung).
    expect(
      kontrastVerhaeltnis(ROUTEN_FARBE, KARTENGRUND_HELL),
    ).toBeGreaterThanOrEqual(7);
  });
});
