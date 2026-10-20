import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Die Groesse des Tippziels wird deshalb direkt am CSS
// geprueft (siehe app/go/components/header.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function regel(css: string, klasse: string) {
  return css.match(new RegExp(`\\.${klasse}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * bug-063: die Auswahl hinter "Mehr" uebernimmt die Wege aus der Kopfzeile --
 * jede Trefferflaeche bleibt dabei bei mindestens 44 x 44 px (stack.md,
 * Bildschirmbreiten, Regel 4).
 */
describe('Auswahl "Mehr" des Begleiters -- Trefferflaechen (bug-063)', () => {
  const css = readCss("./mehr-sheet.module.css");

  it("gibt jedem Eintrag ein Tippziel von mindestens 44 px Hoehe", () => {
    expect(regel(css, "item")).toMatch(/min-height:\s*44px/);
  });

  it("gibt jedem Farbwelt-Eintrag ein Tippziel von mindestens 44 px Hoehe", () => {
    expect(regel(css, "themeItem")).toMatch(/min-height:\s*44px/);
  });
});
