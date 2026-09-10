import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Die Groesse des Tippziels wird deshalb direkt am CSS
// geprueft (siehe app/go/go-view.layout.test.ts, bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("Kopfbereich des Begleiters -- Wechsel in den Planer (req-055)", () => {
  it("gibt dem Wechsel ein Tippziel von mindestens 44 x 44 px", () => {
    const css = readCss("./header.module.css");
    const regel = css.match(/\.wechsel\s*{[^}]*}/)?.[0] ?? "";

    // Mit dem Finger bedient (siehe stack.md, Bildschirmbreiten). Seit
    // bug-035 traegt er eine Beschriftung und ist damit breiter als hoch --
    // 44px sind das Mindestmass, nicht das feste Mass.
    expect(regel).toMatch(/min-width:\s*44px/);
    expect(regel).toMatch(/min-height:\s*44px/);
  });

  it("laesst ihn nicht schrumpfen, wenn der Reisetitel lang ist", () => {
    const css = readCss("./header.module.css");
    const regel = css.match(/\.wechsel\s*{[^}]*}/)?.[0] ?? "";

    expect(regel).toMatch(/flex:\s*none/);
  });

  // bug-035: allein mit Symbol ging er zwischen den uebrigen Symbolen der
  // Kopfzeile unter. Seine Beschriftung darf deshalb nicht umbrechen.
  it("laesst die Beschriftung des Wechsels nicht umbrechen", () => {
    const css = readCss("./header.module.css");
    const regel = css.match(/\.wechselText\s*{[^}]*}/)?.[0] ?? "";

    expect(regel).toMatch(/white-space:\s*nowrap/);
  });
});
