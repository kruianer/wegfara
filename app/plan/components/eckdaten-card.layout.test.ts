import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob "Beginn" und "Ende" nebeneinander stehen,
// ohne sich zu ueberlappen (bug-019), wird deshalb direkt am CSS geprueft
// statt am gerenderten DOM (siehe poi-form.layout.test.ts, bug-016).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Der Rumpf der ersten Regel, deren Selektor genau so dasteht. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

describe('eckdaten-card Layout -- "Beginn" und "Ende" (bug-019)', () => {
  const css = readCss("../../../components/cards.module.css");

  it("laesst die beiden Spalten des Rasters nicht mitwachsen", () => {
    // minmax(0, 1fr) statt 1fr: eine Spalte waechst nie ueber ihren Anteil
    // hinaus, nur weil ihr Inhalt breiter ist.
    expect(rule(css, ".formFields")).toMatch(
      /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
  });

  it("nimmt dem Datumsfeld die eingebaute Breite seines Bedienteils", () => {
    // Ohne appearance: none leitet WebKit die Breite aus dem eingebauten
    // Kalender-Bedienteil ab und uebergeht width: 100%.
    const datum = rule(css, '.input[type="date"]');
    expect(datum).toMatch(/-webkit-appearance:\s*none/);
    expect(datum).toMatch(/[^-]appearance:\s*none/);
  });

  it("laesst das Datumsfeld auf die Breite seiner Spalte schrumpfen", () => {
    // min-width: auto ist die Voreinstellung und haelt ein Formularelement
    // auf der Breite seines Inhalts -- damit ragte "Beginn" ueber seine
    // Spalte hinaus und legte sich ueber "Ende".
    const datum = rule(css, '.input[type="date"]');
    expect(datum).toMatch(/min-width:\s*0/);
    expect(datum).toMatch(/max-width:\s*100%/);
  });

  it("haelt die inneren Teile des Datumsfelds ohne eigenen Innenabstand", () => {
    // Sie kaemen zum Innenabstand des Felds hinzu und schoeben den Wert
    // ueber dessen Rand.
    const innen =
      css.match(/\.input::-webkit-datetime-edit[^{]*{[^}]*}/)?.[0] ?? "";
    expect(innen).toMatch(/padding:\s*0/);
  });

  it("gibt dem Datumsfeld dieselbe Zeilenhoehe wie den Feldern daneben", () => {
    expect(rule(css, '.input[type="date"]')).toMatch(/line-height:\s*1\.25/);
  });
});
