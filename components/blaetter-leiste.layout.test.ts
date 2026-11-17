import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- Mass der Knoepfe und der ausgeblendete
// Bildlaufbalken werden deshalb am CSS geprueft (siehe
// tippziel-checkbox.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("BlaetterLeiste Layout (req-110)", () => {
  const css = readCss("./blaetter-leiste.module.css");

  it("gibt jedem Knopf ein Tippziel von 44 x 44 px (stack.md, Regel 4)", () => {
    const knopf = rule(css, "\\.knopf");
    expect(knopf).toMatch(/width:\s*var\(--tippziel,\s*44px\)/);
    expect(knopf).toMatch(/height:\s*var\(--tippziel,\s*44px\)/);
    expect(knopf).toMatch(/box-sizing:\s*border-box/);
    expect(knopf).toMatch(/flex:\s*none/);
  });

  it("macht einen abgeschalteten Knopf blass, laesst ihn aber stehen", () => {
    const aus = rule(css, "\\.knopf:disabled");
    expect(aus).toMatch(/opacity:\s*0\.35/);
    expect(aus).not.toMatch(/display:\s*none/);
  });

  it("laesst die Leiste rollen und blendet den Bildlaufbalken weiterhin aus", () => {
    const leiste = rule(css, "\\.leiste");
    expect(leiste).toMatch(/overflow-x:\s*auto/);
    expect(leiste).toMatch(/scrollbar-width:\s*none/);
    expect(leiste).toMatch(/min-width:\s*0/);
    expect(rule(css, "\\.leiste::-webkit-scrollbar")).toMatch(
      /display:\s*none/,
    );
  });

  it("misst die Eintraege ab der Leiste selbst", () => {
    expect(rule(css, "\\.leiste")).toMatch(/position:\s*relative/);
  });
});
