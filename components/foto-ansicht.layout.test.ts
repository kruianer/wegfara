import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Grossansicht bei 375, 768 und 1280 px
// benutzbar bleibt, wird deshalb direkt am CSS geprueft statt am gerenderten
// DOM (siehe app/go/go-view.layout.test.ts, bug-001).
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
 * Die Grossansicht eines Fotos (bug-038) ist ein Tippziel-Umfeld wie jedes
 * andere: die vier Regeln aus delivery/stack.md gelten auch ueber der
 * abgedunkelten Seite.
 */
describe("FotoAnsicht Layout (bug-038)", () => {
  const css = readCss("./foto-ansicht.module.css");

  it("legt sich ueber die ganze Seite, ohne sie zu verbreitern", () => {
    const overlay = rule(css, "overlay");
    expect(overlay).toMatch(/position:\s*fixed/);
    expect(overlay).toMatch(/inset:\s*0/);
  });

  it("laesst die Flaeche nie breiter werden als der Bildschirm", () => {
    // min(..., 100%) haelt sie bei 375px innerhalb des Randes -- Regel 1
    // (nichts steht ueber den Rand).
    const panel = rule(css, "panel");
    expect(panel).toMatch(/width:\s*min\([^)]*100%\)/);
    expect(panel).toMatch(/height:\s*min\([^)]*100%\)/);
    expect(panel).toMatch(/overflow:\s*hidden/);
  });

  it("bricht die Leiste um, statt ihre Knoepfe aus ihr ragen zu lassen", () => {
    // Bei 375px passen Titel, Blaettern und "Schließen" nicht nebeneinander.
    const bar = rule(css, "bar");
    expect(bar).toMatch(/display:\s*flex/);
    expect(bar).toMatch(/flex-wrap:\s*wrap/);
  });

  it("gibt Blaettern und Schliessen 44x44 px Trefferflaeche (Regel 4)", () => {
    const knoepfe = css.match(/\.pageButton,\s*\.close\s*{[^}]*}/)?.[0] ?? "";
    expect(knoepfe).toMatch(/min-height:\s*44px/);
    expect(knoepfe).toMatch(/min-width:\s*44px/);
    expect(knoepfe).toMatch(/box-sizing:\s*border-box/);
  });

  it("bricht die Beschriftung der Knoepfe nicht mitten im Wort", () => {
    const knoepfe = css.match(/\.pageButton,\s*\.close\s*{[^}]*}/)?.[0] ?? "";
    expect(knoepfe).toMatch(/white-space:\s*nowrap/);
    expect(rule(css, "pageLabel")).toMatch(/white-space:\s*nowrap/);
  });

  it("laesst dem Titel die uebrige Breite und kuerzt ihn statt zu drueckeln", () => {
    const titel = rule(css, "titel");
    expect(titel).toMatch(/flex:\s*1/);
    expect(titel).toMatch(/min-width:\s*0/);
    expect(titel).toMatch(/text-overflow:\s*ellipsis/);
  });

  it("zeigt das Bild vollstaendig, statt es zu beschneiden", () => {
    const image = rule(css, "image");
    expect(image).toMatch(/object-fit:\s*contain/);
    expect(image).toMatch(/width:\s*100%/);
    // Ohne min-height: 0 waechst das Bild ueber die Flaeche hinaus, statt
    // sich in ihren Rest zu fuegen.
    expect(image).toMatch(/min-height:\s*0/);
  });
});
