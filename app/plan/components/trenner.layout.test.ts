import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob sich der Trenner mit dem Finger treffen
// laesst (bug-031), wird deshalb direkt am CSS geprueft statt am gerenderten
// DOM (siehe poi-list.layout.test.ts, bug-014). Bis req-109 stand er in
// split-view.module.css; seitdem teilen ihn SplitView und Planung.
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const css = readCss("./trenner.module.css");

function rule(selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/** Der Block einer Media Query samt der Regeln darin. */
function mediaBlock(condition: string) {
  const start = css.indexOf(`@media ${condition}`);
  return start < 0 ? "" : css.slice(start, css.indexOf("\n}", start));
}

describe("trenner Layout -- Greifflaeche (bug-031)", () => {
  it("gibt der Leiste am Touch-Geraet eine mit dem Finger treffbare Breite", () => {
    // 8 px sind mit dem Finger nicht zu treffen (44 px, siehe stack.md).
    const grob = mediaBlock("(pointer: coarse)");

    expect(grob).toMatch(/\.trenner::before\b/);
    expect(grob).toMatch(/width:\s*var\(--tippziel\)/);
    expect(grob).toMatch(/position:\s*absolute/);
  });

  it("laesst die Leiste selbst schmal aussehen -- ihre Breite ist ein Token (req-109)", () => {
    // Die Greifflaeche liegt unsichtbar ueber den Nachbarspalten; die Leiste
    // bleibt 8 px breit und bekommt keinen eigenen Hintergrund dazu.
    expect(rule("trenner")).toMatch(/width:\s*var\(--trenner-breite\)/);
    expect(mediaBlock("(pointer: coarse)")).not.toMatch(/background/);
  });

  it("liegt am Touch-Geraet ueber den Spalten", () => {
    const ebene = Number(
      /z-index:\s*(\d+)/.exec(mediaBlock("(pointer: coarse)"))?.[1],
    );

    expect(ebene).toBeGreaterThan(0);
  });

  it("gibt der Leiste den Zeiger und nicht dem Rollen", () => {
    // Sonst nimmt der Browser die Geste an sich, bevor der Zug ankommt
    // (wie bei den POI-Karten, bug-023).
    expect(rule("trenner")).toMatch(/touch-action:\s*none/);
    expect(rule("trenner")).toMatch(/user-select:\s*none/);
  });
});
