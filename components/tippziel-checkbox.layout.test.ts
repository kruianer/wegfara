import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- wie gross das Kaestchen aussieht und wie gross
// es sich treffen laesst, wird deshalb direkt am CSS geprueft statt am
// gerenderten DOM (siehe app/go/go-view.layout.test.ts, bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * Die Trefferflaeche darf groesser sein als das, was man sieht (bug-025):
 * das Eingabefeld nimmt die ganzen 44x44 px ein und ist unsichtbar, gezeichnet
 * wird allein das kleine Kaestchen darueber.
 */
describe("TippzielCheckbox Layout (bug-025)", () => {
  const css = readCss("./tippziel-checkbox.module.css");

  it("gibt der Trefferflaeche 44x44 px (stack.md, Bildschirmbreiten, Regel 4)", () => {
    const wrap = rule(css, "wrap");
    expect(wrap).toMatch(/width:\s*44px/);
    expect(wrap).toMatch(/height:\s*44px/);
    expect(wrap).toMatch(/position:\s*relative/);
  });

  it("laesst das unsichtbare Eingabefeld die ganze Trefferflaeche fuellen", () => {
    const input = rule(css, "input");
    expect(input).toMatch(/position:\s*absolute/);
    expect(input).toMatch(/inset:\s*0/);
    expect(input).toMatch(/opacity:\s*0/);
  });

  it("zeichnet das sichtbare Kaestchen in gewohnter Groesse (deutlich unter 44px)", () => {
    const box = rule(css, "box");
    const breite = Number(box.match(/width:\s*(\d+(?:\.\d+)?)px/)?.[1]);
    const hoehe = Number(box.match(/height:\s*(\d+(?:\.\d+)?)px/)?.[1]);
    expect(breite).toBeGreaterThan(0);
    expect(breite).toBeLessThanOrEqual(20);
    expect(hoehe).toBe(breite);
  });

  it("laesst Klicks durch das Kaestchen auf das Eingabefeld darunter durch", () => {
    // Sonst liegt an der Mittelposition das Kaestchen statt des Feldes --
    // Regel 3 der Bildschirmbreiten-Pruefung (req-049) meldet das als
    // "verdeckt durch".
    expect(rule(css, "box")).toMatch(/pointer-events:\s*none/);
  });

  it("zeigt den angekreuzten Zustand am Kaestchen, nicht am Eingabefeld", () => {
    expect(css).toMatch(/\.input:checked\s*\+\s*\.box\s*{/);
    expect(css).toMatch(/\.input:checked\s*\+\s*\.box::after\s*{/);
  });

  it("macht den Tastatur-Fokus sichtbar", () => {
    expect(css).toMatch(/\.input:focus-visible\s*\+\s*\.box\s*{[^}]*outline/);
  });
});
