import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Die Groesse des Tippziels wird deshalb direkt am CSS
// geprueft (siehe app/go/components/activity-card.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function regel(css: string, klasse: string) {
  return css.match(new RegExp(`\\.${klasse}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * Die Wege zum Ort stehen auf der Kachel als Symbole ohne Beschriftung
 * (req-079). Damit haengt ihre Trefferflaeche nicht mehr an einem Text --
 * sie muss aus sich heraus 44x44 px gross sein (stack.md,
 * Bildschirmbreiten, Regel 4; vgl. bug-057).
 */
describe("Wege zum Ort auf der Kachel (req-079)", () => {
  const css = readCss("./kachel-links.module.css");

  it("gibt jedem Symbol ein Tippziel von 44x44 px", () => {
    const link = regel(css, "link");

    expect(link).toMatch(/width:\s*44px/);
    expect(link).toMatch(/height:\s*44px/);
    expect(link).toMatch(/display:\s*inline-flex/);
    expect(link).toMatch(/align-items:\s*center/);
    expect(link).toMatch(/justify-content:\s*center/);
  });

  it("laesst die Symbole umbrechen, statt sie zusammenzudruecken", () => {
    const leiste = regel(css, "links");

    // Bei 375 px ist die Kachel schmal: vier Symbole mit Abstand muessen
    // umbrechen duerfen (Regel 1), und keines darf dabei schmaler werden
    // als sein Tippziel.
    expect(leiste).toMatch(/flex-wrap:\s*wrap/);
    expect(leiste).toMatch(/gap:\s*\d/);
    expect(regel(css, "link")).toMatch(/flex:\s*none/);
  });
});
