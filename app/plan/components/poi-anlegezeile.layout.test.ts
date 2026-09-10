import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- die Bildschirmregeln aus delivery/stack.md
// werden deshalb direkt am CSS geprueft statt am gerenderten DOM (siehe
// app/go/go-view.layout.test.ts, bug-001).
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
 * Die Anlegezeile (req-060) traegt ein Eingabefeld und zwei Schaltflaechen
 * nebeneinander. Anders als das Wunschfeld der KI-Suche zuvor ist das Feld
 * immer bedienbar -- damit gilt fuer es die Tippziel-Regel aus
 * delivery/stack.md (Regel 4, vgl. bug-024).
 */
describe("poi-anlegezeile Layout — Tippziele (req-060)", () => {
  const css = readCss("./poi-anlegezeile.module.css");

  it("gibt dem Eingabefeld mindestens 44px Hoehe", () => {
    const feld = rule(css, "input");
    expect(feld).toMatch(/min-height:\s*44px/);
    expect(feld).toMatch(/box-sizing:\s*border-box/);
  });

  it('gibt "Mit KI suchen" und "POI anlegen" mindestens 44px Hoehe', () => {
    const knoepfe = css.match(/\.aiButton,\s*\.createButton\s*{[^}]*}/)?.[0];
    expect(knoepfe).toMatch(/min-height:\s*44px/);
    expect(knoepfe).toMatch(/box-sizing:\s*border-box/);
  });

  it("gibt jedem Ortsvorschlag mindestens 44px Hoehe", () => {
    const vorschlag = rule(css, "suggestion");
    expect(vorschlag).toMatch(/min-height:\s*44px/);
    expect(vorschlag).toMatch(/box-sizing:\s*border-box/);
  });

  it("laesst die Zeile umbrechen, statt aus der Spalte zu ragen", () => {
    const controls = rule(css, "controls");
    expect(controls).toMatch(/display:\s*flex/);
    expect(controls).toMatch(/flex-wrap:\s*wrap/);
    // Ohne min-width am Feld draengt es die Knoepfe bei 375px hinaus.
    expect(rule(css, "input")).toMatch(/min-width:/);
  });

  it("legt die Vorschlagsliste ueber den Filter, statt ihn zu verschieben", () => {
    expect(rule(css, "controls")).toMatch(/position:\s*relative/);
    const vorschlaege = rule(css, "suggestions");
    expect(vorschlaege).toMatch(/position:\s*absolute/);
    expect(vorschlaege).toMatch(/z-index:/);
  });
});
