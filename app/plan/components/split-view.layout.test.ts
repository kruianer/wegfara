import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob "Liste ausblenden" mit dem Finger bedienbar
// ist (bug-024) und ob sich die Trennleiste mit dem Finger treffen laesst
// (bug-031), wird deshalb direkt am CSS geprueft statt am gerenderten DOM
// (siehe poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const css = readCss("./split-view.module.css");

function rule(selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("split-view Layout -- Tippziel von „Liste ausblenden“ (bug-024)", () => {
  it("gibt der Schaltflaeche mindestens 44px Hoehe", () => {
    const toggle = rule("collapseToggle");

    expect(toggle).toMatch(/min-height:\s*44px/);
    expect(toggle).toMatch(/box-sizing:\s*border-box/);
  });
});

describe("split-view Layout -- Trennleiste (bug-031)", () => {
  it("zeichnet keine eigene Leiste -- sie ist der geteilte Trenner (req-109)", () => {
    expect(css).not.toMatch(/\.divider\b/);
    expect(readCss("./split-view.tsx")).toMatch(/<Trenner\b/);
  });

  it("legt die Leiste ueber die Spalten, aber unter die Schaltflaeche", () => {
    const trenner = readCss("./trenner.module.css");
    const start = trenner.indexOf("@media (pointer: coarse)");
    const ebeneLeiste = Number(
      /z-index:\s*(\d+)/.exec(trenner.slice(start))?.[1],
    );
    const ebeneToggle = Number(
      /z-index:\s*(\d+)/.exec(rule("collapseToggle"))?.[1],
    );

    expect(ebeneLeiste).toBeGreaterThan(0);
    expect(ebeneLeiste).toBeLessThan(ebeneToggle);
  });
});

/**
 * „Liste ausblenden" stand mit vollem Text auf der Karte (bug-042). Der Knopf
 * traegt jetzt ein Vollbild-Symbol: Trefferflaeche 44x44 px, sichtbar die
 * gewohnten 30px -- wie die Symbole der Karte (bug-040).
 */
describe("split-view Layout -- Vollbild-Symbol statt Text (bug-042)", () => {
  /** Die gewohnte sichtbare Hoehe der Bedienelemente des Planers. */
  const GEWOHNTE_HOEHE = 30;

  it("haelt die Trefferflaeche bei 44x44 px", () => {
    const toggle = rule("collapseToggle");

    expect(toggle).toMatch(/min-height:\s*44px/);
    expect(toggle).toMatch(/min-width:\s*44px/);
  });

  it("zeichnet darin nur die gewohnte Hoehe", () => {
    const chip = rule("collapseChip");

    expect(chip).toMatch(new RegExp(`width:\\s*${GEWOHNTE_HOEHE}px`));
    expect(chip).toMatch(new RegExp(`height:\\s*${GEWOHNTE_HOEHE}px`));
  });

  it("legt das Glas in das Sichtbare und nicht auf die Trefferflaeche", () => {
    // Ein durchsichtiger Rand am Knopf selbst genuegt hier nicht: die
    // Glasscheibe (backdrop-filter) wirkt ueber seine ganze Flaeche und
    // liesse die Trefferflaeche als 44px grossen Kreis sichtbar werden.
    expect(rule("collapseChip")).toMatch(/backdrop-filter:\s*blur/);
    expect(rule("collapseToggle")).not.toMatch(/backdrop-filter/);
    expect(rule("collapseToggle")).not.toMatch(/background:\s*var\(/);
  });
});

describe("split-view Layout -- eine Seite bei schmaler Breite (req-088)", () => {
  it("stellt den Umschalter ueber die Seite, nicht daneben", () => {
    expect(rule("einzeln")).toMatch(/flex-direction:\s*column/);
    expect(rule("einzeln")).toMatch(/min-width:\s*0/);
  });

  it("laesst die eine Seite die ganze Flaeche fuellen", () => {
    const seite = css.match(/\.einzeln \.pane\s*{[^}]*}/)?.[0] ?? "";
    expect(seite).toMatch(/flex:\s*1/);
    // Die Seite selbst haelt min-width: 0 -- sonst schoebe ihr Inhalt sie
    // ueber den Rand (stack.md, Bildschirmbreiten, Regel 1).
    expect(rule("pane")).toMatch(/min-width:\s*0/);
  });
});
