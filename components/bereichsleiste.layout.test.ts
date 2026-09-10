import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Leiste mit dem Finger bedienbar ist und
// auf schmalen Bildschirmen im Rand bleibt, wird deshalb direkt am CSS
// geprueft statt am gerenderten DOM (siehe poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("Bereichsleiste Layout (bug-024, bug-033)", () => {
  const css = readCss("./bereichsleiste.module.css");

  it("gibt den Bereichs-Knoepfen und Verweisen (POIs, Begleiter, ...) mindestens 44px Hoehe", () => {
    const navButton = rule(css, "navButton");
    expect(navButton).toMatch(/min-height:\s*44px/);
    expect(navButton).toMatch(/box-sizing:\s*border-box/);
  });

  /**
   * Die Leiste steht seit bug-033 auch in "Mein Bereich", und den ruft auf,
   * wer nur das Smartphone dabei hat (req-043). Bei 375px muss sie umbrechen,
   * statt ueber den Rand zu stehen (stack.md, Bildschirmbreiten, Regel 1).
   */
  it("bricht um, statt seitlich hinauszuragen", () => {
    expect(rule(css, "leiste")).toMatch(/flex-wrap:\s*wrap/);
    expect(rule(css, "nav")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("waechst mit, wenn sie umgebrochen ist", () => {
    const leiste = rule(css, "leiste");
    expect(leiste).toMatch(/min-height:\s*66px/);
    expect(leiste).not.toMatch(/[^-]height:\s*66px/);
    expect(leiste).toMatch(/box-sizing:\s*border-box/);
  });
});
