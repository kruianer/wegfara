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

    // Mit dem Finger bedient (siehe stack.md, Bildschirmbreiten).
    expect(regel).toMatch(/width:\s*44px/);
    expect(regel).toMatch(/height:\s*44px/);
  });

  it("laesst ihn nicht schrumpfen, wenn der Reisetitel lang ist", () => {
    const css = readCss("./header.module.css");
    const regel = css.match(/\.wechsel\s*{[^}]*}/)?.[0] ?? "";

    expect(regel).toMatch(/flex:\s*none/);
  });
});
