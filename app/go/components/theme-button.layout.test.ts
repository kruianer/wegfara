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

function zahl(regelText: string, eigenschaft: string): number | null {
  const wert = regelText.match(new RegExp(`${eigenschaft}:\\s*([0-9.]+)`))?.[1];
  return wert === undefined ? null : Number(wert);
}

/**
 * bug-057: der runde Knopf war 36x36 px gross -- zu klein fuer den Finger
 * (stack.md, Bildschirmbreiten, Regel 4). Sichtbar soll er genau diese 36 px
 * bleiben: er zeichnet seinen Ring selbst, ein Wachsen auf 44 px veraenderte
 * also das Bild (vgl. bug-025).
 */
describe("Farbwelt-Knopf des Begleiters -- Trefferflaeche und sichtbare Groesse (bug-057)", () => {
  const button = regel(readCss("./theme-button.module.css"), "button");

  it("gibt dem Knopf eine Trefferflaeche von 44x44 px", () => {
    expect(zahl(button, "width")).toBe(44);
    expect(zahl(button, "height")).toBe(44);
    // Ohne "border-box" kaeme der unsichtbare Rand auf die 44 px obendrauf.
    expect(button).toMatch(/box-sizing:\s*border-box/);
  });

  it("zeichnet darin weiterhin nur 36 px", () => {
    const rand = zahl(button, "border");

    // Die aeusseren 4 px tragen allein die Trefferflaeche: 44 - 2 * 4 = 36.
    expect(rand).toBe(4);
    expect(button).toMatch(/border:\s*4px solid transparent/);
    expect(44 - 2 * rand!).toBe(36);
  });

  it("laesst den unsichtbaren Rand unsichtbar", () => {
    // Der Hintergrund endet an der Innenkante, der sichtbare 1-px-Rand ist ein
    // innerer Schatten -- ein echter Rand faerbte die Trefferflaeche mit
    // (dieselbe Loesung wie bug-025 und bug-039).
    expect(button).toMatch(/background:\s*var\(--sur2\) padding-box/);
    expect(button).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  });

  it("bleibt rund", () => {
    // 50% vom 44-px-Rahmen sind 22 px Radius; abzueglich der 4 px Rand bleibt
    // die Innenkante mit 18 px Radius ein Kreis von 36 px.
    expect(button).toMatch(/border-radius:\s*50%/);
  });

  it("laesst den Knopf in der Kopfzeile nicht schrumpfen", () => {
    expect(button).toMatch(/flex:\s*none/);
  });
});
