import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- geprueft wird deshalb direkt am CSS statt am
// gerenderten DOM (siehe eckdaten-card.layout.test.ts, bug-019).
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

/**
 * Die Rueckfrage vor einer ungewoehnlich langen Reise (bug-050) benutzt die
 * Flaeche der uebrigen Rueckfragen des Planers. Sie muss bei 375, 768 und
 * 1280 px benutzbar bleiben (stack.md, Bildschirmbreiten).
 */
describe("lange-reise-dialog Layout (bug-050)", () => {
  const css = readCss("../../../components/dialog.module.css");

  it("gibt den beiden Knoepfen ein Tippziel von 44 px Hoehe", () => {
    // "Zeitraum ändern" und "Trotzdem speichern" werden auf dem iPad mit dem
    // Finger bedient (stack.md, Regel 4).
    const knoepfe =
      css.match(
        /\.dangerButton,\s*\.primaryButton,\s*\.secondaryButton\s*{[^}]*}/,
      )?.[0] ?? "";
    expect(knoepfe).toMatch(/min-height:\s*44px/);
  });

  it("laesst die Flaeche auf schmale Bildschirme schrumpfen", () => {
    // width: 100% mit einer Hoechstbreite -- bei 375 px fuellt sie die
    // Breite, bei 1280 px bleibt sie lesbar schmal.
    const flaeche = rule(css, ".card");
    expect(flaeche).toMatch(/width:\s*100%/);
    expect(flaeche).toMatch(/max-width:\s*480px/);
  });

  it("haelt die Flaeche vom Rand des Bildschirms weg", () => {
    expect(rule(css, ".overlay")).toMatch(/padding:\s*24px/);
  });

  it("laesst einen langen Inhalt scrollen, statt ihn abzuschneiden", () => {
    // Bei 375 px steht die Rueckfrage sonst ueber den unteren Rand hinaus --
    // und mit ihr die Knoepfe (stack.md, Regel 3).
    const flaeche = rule(css, ".card");
    expect(flaeche).toMatch(/max-height:\s*90dvh/);
    expect(flaeche).toMatch(/overflow-y:\s*auto/);
  });
});
