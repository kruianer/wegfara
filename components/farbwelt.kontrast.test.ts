import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  kontrastVerhaeltnis,
  leuchtdichte,
  MINDESTKONTRAST_FLIESSTEXT,
} from "@/lib/design/kontrast";

/**
 * Die Farbwelt "Indigo-Nacht" (req-015) steht als Design Tokens in mehreren
 * CSS-Blaettern, weil die Seiten ausserhalb des Planers eigene Wurzeln haben.
 * jsdom fuehrt kein CSS aus -- geprueft wird deshalb direkt am Blatt
 * (wie in bereichsleiste.layout.test.ts).
 *
 * bug-051: `--text-4` erreichte auf den Kartenflaechen nur 2,2:1 und
 * verschwamm mit dem Hintergrund, `--text-3` lag mit 4,49:1 haarscharf
 * darunter. Beide Stufen tragen sehr kleine Schrift -- die Stundenbeschriftung
 * des Zeitstrahls (10px), die Detail-Labels der Karten (9,5px).
 */
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function token(css: string, name: string): string | null {
  return (
    css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))?.[1] ?? null
  );
}

/** Jedes Blatt, das die Farbwelt mitbringt (siehe Notes in bug-051). */
const BLAETTER = [
  "../app/plan/plan-view.module.css",
  "../app/plan/accounts/accounts-view.module.css",
  "../app/mein-bereich/mein-bereich.module.css",
  "./auth-panel.module.css",
] as const;

const TEXTSTUFEN = ["text", "text-2", "text-3", "text-4"] as const;

const planer = readCss("../app/plan/plan-view.module.css");

function textstufe(name: (typeof TEXTSTUFEN)[number]): string {
  const wert = token(planer, name);
  if (!wert) throw new Error(`--${name} steht nicht in plan-view.module.css`);
  return wert;
}

describe("Farbwelt Indigo-Nacht -- Kontrast der Textstufen (bug-051)", () => {
  const flaechen = {
    "--card": token(planer, "card")!,
    "--card-alt": token(planer, "card-alt")!,
  };

  for (const stufe of ["text-3", "text-4"] as const) {
    for (const [name, flaeche] of Object.entries(flaechen)) {
      it(`haelt --${stufe} auf ${name} ueber ${MINDESTKONTRAST_FLIESSTEXT}:1`, () => {
        expect(
          kontrastVerhaeltnis(textstufe(stufe), flaeche),
        ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
      });
    }
  }

  it("haelt auch die beiden hellen Stufen ueber der Grenze", () => {
    for (const stufe of ["text", "text-2"] as const) {
      for (const flaeche of Object.values(flaechen)) {
        expect(
          kontrastVerhaeltnis(textstufe(stufe), flaeche),
        ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
      }
    }
  });

  /**
   * Aufhellen darf die Stufen nicht einebnen: --text-4 bleibt die leiseste,
   * sie wird nur lesbar (bug-051, Erwartete Behebung).
   */
  it("haelt die Abstufung der vier Textstufen erkennbar", () => {
    const dichten = TEXTSTUFEN.map((stufe) => leuchtdichte(textstufe(stufe)));
    for (let i = 1; i < dichten.length; i += 1) {
      expect(dichten[i]).toBeLessThan(dichten[i - 1]);
    }
    for (let i = 1; i < TEXTSTUFEN.length; i += 1) {
      // Ein Schritt, den man sieht -- nicht vier Nuancen derselben Farbe.
      expect(
        kontrastVerhaeltnis(
          textstufe(TEXTSTUFEN[i]),
          textstufe(TEXTSTUFEN[i - 1]),
        ),
      ).toBeGreaterThanOrEqual(1.25);
    }
  });

  /**
   * Der abgeschaltete Bereichs-Knopf traegt --text-4 auf --deep. Dort zaehlt
   * nicht die Lesbarkeitsgrenze fuer Fliesstext, aber verschwinden soll er
   * auch nicht -- und leiser als ein bedienbarer Knopf (--text-3) bleibt er.
   */
  it("laesst den abgeschalteten Bereichs-Knopf leise, aber sichtbar", () => {
    const leiste = readCss("./bereichsleiste.module.css");
    expect(leiste).toMatch(
      /\.navButton:disabled\s*{[^}]*color:\s*var\(--text-4\)/,
    );
    expect(leiste).toMatch(/\.navButton\s*{[^}]*color:\s*var\(--text-3\)/);

    const deep = token(planer, "deep")!;
    expect(
      kontrastVerhaeltnis(textstufe("text-4"), deep),
    ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    expect(leuchtdichte(textstufe("text-4"))).toBeLessThan(
      leuchtdichte(textstufe("text-3")),
    );
  });

  /**
   * Die Farbwerte stehen mehrfach gleichlautend in verschiedenen Blaettern.
   * Laufen sie auseinander, ist die Schrift je nach Ansicht verschieden hell
   * (bug-051, Notes).
   */
  it("traegt in jedem Blatt dieselben Werte", () => {
    for (const blatt of BLAETTER) {
      const css = readCss(blatt);
      for (const stufe of TEXTSTUFEN) {
        const wert = token(css, stufe);
        // auth-panel fuehrt nur die drei Stufen, die es braucht.
        if (wert === null) continue;
        expect(`${blatt}: --${stufe}: ${wert}`).toBe(
          `${blatt}: --${stufe}: ${textstufe(stufe)}`,
        );
      }
      for (const flaeche of ["card", "card-alt"] as const) {
        const wert = token(css, flaeche);
        if (wert === null) continue;
        expect(`${blatt}: --${flaeche}: ${wert}`).toBe(
          `${blatt}: --${flaeche}: ${flaechen[`--${flaeche}`]}`,
        );
      }
    }
  });
});
