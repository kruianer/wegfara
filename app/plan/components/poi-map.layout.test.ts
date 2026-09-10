import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob der Kartenfläche die Behandlung von
// Touch-Gesten uebergeben wird (bug-005), wird deshalb direkt am CSS
// geprueft statt am gerenderten DOM (siehe app/go/go-view.layout.test.ts,
// bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("poi-map Layout -- Touch-Verhalten der Kartenflaeche (bug-005)", () => {
  it("ueberlaesst Touch-Gesten auf der Kartenflaeche vollstaendig MapLibre", () => {
    const css = readCss("./poi-map.module.css");
    const mapRule = css.match(/\.map\s*{[^}]*}/)?.[0] ?? "";

    expect(mapRule).toMatch(/touch-action:\s*none/);
  });
});

/**
 * Die automatische Bildschirmbreiten-Pruefung (req-049) deckte auf, dass
 * "Suchgebiet zeichnen" und die Status-Schalter der Karte kleiner als die
 * geforderten 44x44 px waren (bug-024).
 */
describe("poi-map Layout -- Tippziele (bug-024)", () => {
  const css = readCss("./poi-map.module.css");

  it('gibt "Suchgebiet zeichnen" mindestens 44px Hoehe', () => {
    const drawButton = css.match(/\.drawButton\s*{[^}]*}/)?.[0] ?? "";
    expect(drawButton).toMatch(/min-height:\s*44px/);
    expect(drawButton).toMatch(/box-sizing:\s*border-box/);
  });
});

/**
 * Die 44x44 px grossen Schalter der Legende sahen unnatuerlich gross aus
 * (bug-025). Sie kommen jetzt aus components/tippziel-checkbox.tsx: die
 * Trefferflaeche bleibt 44x44 px, gezeichnet wird ein gewohntes Kaestchen.
 */
describe("poi-map Layout -- sichtbare Groesse der Legende (bug-025)", () => {
  const css = readCss("./poi-map.module.css");

  it("baut die Status-Schalter nicht mehr selbst 44x44 px gross", () => {
    expect(css).not.toMatch(/\.statusFilterSwitch\s*{/);
  });

  it("nimmt der Legende die Breite zurueck, die die grossen Schalter brauchten", () => {
    const panel = css.match(/\.statusFilterPanel\s*{[^}]*}/)?.[0] ?? "";
    const breite = Number(panel.match(/width:\s*(\d+)px/)?.[1]);
    expect(breite).toBeLessThanOrEqual(242);
  });
});
