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

  it("macht die Status-Schalter der Karte 44x44px gross", () => {
    const switchRule = css.match(/\.statusFilterSwitch\s*{[^}]*}/)?.[0] ?? "";
    expect(switchRule).toMatch(/width:\s*44px/);
    expect(switchRule).toMatch(/height:\s*44px/);
  });
});
