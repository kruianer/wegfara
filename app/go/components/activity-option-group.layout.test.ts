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
  const wert = regelText.match(
    new RegExp(`${eigenschaft}:\\s*(-?[0-9.]+)`),
  )?.[1];
  return wert === undefined ? null : Number(wert);
}

/** Die Regel eines Pseudo-Elements, z.B. ".dot::after". */
function pseudoRegel(css: string, klasse: string, pseudo: string) {
  return css.match(new RegExp(`\\.${klasse}::${pseudo}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * bug-057: die Punkte unter einer Options-Gruppe waren 22x22 px gross
 * (stack.md, Bildschirmbreiten, Regel 4). Sie zeichnen nur einen 6-px-Punkt
 * als "::after" -- die Flaeche darf also wachsen, ohne dass sich sichtbar
 * etwas aendert.
 */
describe("Options-Gruppe im Begleiter -- die Punkte als Tippziel (bug-057)", () => {
  const css = readCss("./activity-option-group.module.css");
  const dot = regel(css, "dot");
  const dots = regel(css, "dots");

  it("gibt jedem Punkt ein Tippziel von 44x44 px", () => {
    expect(zahl(dot, "width")).toBe(44);
    expect(zahl(dot, "height")).toBe(44);
  });

  it("zeichnet darin weiterhin nur den 6-px-Punkt", () => {
    const gezeichnet = pseudoRegel(css, "dot", "after");

    expect(zahl(gezeichnet, "width")).toBe(6);
    expect(zahl(gezeichnet, "height")).toBe(6);
    // Die Flaeche selbst zeichnet nichts.
    expect(dot).toMatch(/background:\s*none/);
    expect(dot).toMatch(/border:\s*none/);
    expect(dot).toMatch(/padding:\s*0/);
  });

  it("laesst die Trefferflaechen nicht einander ueberlagern", () => {
    // Jeder Punkt zeichnet sichtbar seinen Punkt -- ueberlagerte Flaechen
    // waeren deshalb eine echte Ueberlappung (Regel 2, anders als bei den
    // unsichtbaren Flaechen aus bug-029). Kein Abstand heisst: sie stossen
    // aneinander, mehr nicht.
    expect(zahl(dots, "gap")).toBe(0);
  });

  it("setzt die Reihe dorthin, wo sie vorher stand", () => {
    // Die Flaeche ragt 19 px ueber ihren Punkt hinaus (44 - 6 = 38, halbiert)
    // und bringt den Abstand zur Karte damit selbst mit; ein eigener kaeme
    // obendrauf.
    expect(zahl(dots, "margin-top")).toBe(0);
  });

  it("laesst die Reihe umbrechen, statt ueber den Rand zu laufen", () => {
    // Regel 1 derselben Vorgabe: bei 375 px passen acht Flaechen in eine
    // Zeile, mehr Optionen brechen um.
    expect(dots).toMatch(/flex-wrap:\s*wrap/);
  });
});
