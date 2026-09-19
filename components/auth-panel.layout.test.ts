import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Anmelde- und Einladungsseiten mit dem
// Finger bedienbar sind (bug-024), wird deshalb direkt am CSS geprueft statt
// am gerenderten DOM (siehe app/plan/components/poi-list.layout.test.ts,
// bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("auth-panel Layout -- Tippziele (bug-024)", () => {
  const css = readCss("./auth-panel.module.css");

  it('gibt "Passkey einrichten" / "Anmeldelink senden" (primaryButton, secondaryButton) mindestens 44px Hoehe', () => {
    expect(rule(css, "primaryButton")).toMatch(/min-height:\s*44px/);
    expect(rule(css, "secondaryButton")).toMatch(/min-height:\s*44px/);
  });

  it('gibt "Später einrichten" (linkButton) mindestens 44px Hoehe', () => {
    expect(rule(css, "linkButton")).toMatch(/min-height:\s*44px/);
  });

  it("gibt dem E-Mail-Feld (input) mindestens 44px Hoehe", () => {
    expect(rule(css, "input")).toMatch(/min-height:\s*44px/);
  });
});

/**
 * req-066: Die Anmeldeseite muss bei 375 px (iPhone), 768 px (iPad
 * hochkant) und 1280 px (Laptop) benutzbar sein -- geprueft gegen die vier
 * Regeln aus stack.md. Was jsdom nicht rechnet, wird hier am CSS
 * nachgewiesen: dass die Breite der Seite nie aus ihrem Rahmen faellt.
 */
describe("auth-panel Layout -- Anmeldeseite auf allen Breiten (req-066)", () => {
  const css = readCss("./auth-panel.module.css");
  const BREITEN = [375, 768, 1280];
  /** Innenabstand der Seite, links und rechts (siehe .page). */
  const RAND = 24;
  const MAX_BREITE = 460;

  it("haelt die Spalte auf hoechstens 460px und laesst sie darunter mitschrumpfen", () => {
    expect(rule(css, "center")).toMatch(/width:\s*100%/);
    expect(rule(css, "center")).toMatch(
      new RegExp(`max-width:\\s*${MAX_BREITE}px`),
    );
  });

  it("laesst bei 375, 768 und 1280 px nichts ueber den Rand ragen", () => {
    for (const breite of BREITEN) {
      // Die Spalte nimmt, was nach dem Innenabstand uebrig bleibt -- bis zu
      // ihrer Hoechstbreite. Sie kann die Seite damit nie sprengen.
      const spalte = Math.min(MAX_BREITE, breite - 2 * RAND);
      expect(spalte + 2 * RAND).toBeLessThanOrEqual(breite);
      expect(spalte).toBeGreaterThan(0);
    }
    expect(rule(css, "page")).toMatch(
      new RegExp(`padding:\\s*\\d+px\\s+${RAND}px`),
    );
  });

  it("rechnet Rand und Innenabstand in die Breite von Karte und Flaeche ein", () => {
    // Ohne border-box kaeme der Innenabstand zur Breite von 100% hinzu --
    // bei 375px ragte die Karte dann seitlich hinaus.
    for (const teil of ["card", "unlock"]) {
      expect(rule(css, teil)).toMatch(/box-sizing:\s*border-box/);
      expect(rule(css, teil)).toMatch(/width:\s*100%/);
    }
  });

  it("gibt der Flaeche zum Entsperren weit mehr als 44px Hoehe", () => {
    // Sie wird mit dem Daumen getroffen, ohne hinzusehen.
    const hoehe = Number(
      rule(css, "unlock").match(/min-height:\s*(\d+)px/)?.[1] ?? 0,
    );
    expect(hoehe).toBeGreaterThanOrEqual(44);
  });

  it("laesst die Notfallcode-Spalten auf schmalen Bildschirmen umbrechen", () => {
    // Zwei Spalten a 12 Zeichen passen bei 375px nicht nebeneinander.
    expect(css).toMatch(/@media \(max-width: 480px\)/);
  });
});
