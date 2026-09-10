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

/** Der Block einer Media Query samt der Regeln darin. */
function mediaBlock(condition: string) {
  const start = css.indexOf(`@media ${condition}`);
  return start < 0 ? "" : css.slice(start, css.indexOf("\n}", start));
}

describe("split-view Layout -- Tippziel von „Liste ausblenden“ (bug-024)", () => {
  it("gibt der Schaltflaeche mindestens 44px Hoehe", () => {
    const toggle = rule("collapseToggle");

    expect(toggle).toMatch(/min-height:\s*44px/);
    expect(toggle).toMatch(/box-sizing:\s*border-box/);
  });
});

describe("split-view Layout -- Greifflaeche der Trennleiste (bug-031)", () => {
  it("gibt der Leiste am Touch-Geraet eine mit dem Finger treffbare Breite", () => {
    // 8 px sind mit dem Finger nicht zu treffen (44 px, siehe stack.md).
    const grob = mediaBlock("(pointer: coarse)");

    expect(grob).toMatch(/\.divider::before\b/);
    expect(grob).toMatch(/width:\s*44px/);
    expect(grob).toMatch(/position:\s*absolute/);
  });

  it("laesst die Leiste selbst schmal aussehen", () => {
    // Die Greifflaeche liegt unsichtbar ueber den Nachbarspalten; die Leiste
    // bleibt 8 px breit und bekommt keinen eigenen Hintergrund dazu.
    expect(rule("divider")).toMatch(/width:\s*8px/);
    expect(mediaBlock("(pointer: coarse)")).not.toMatch(/background/);
  });

  it("liegt ueber den Spalten, aber unter der Schaltflaeche", () => {
    const ebeneLeiste = Number(
      /z-index:\s*(\d+)/.exec(mediaBlock("(pointer: coarse)"))?.[1],
    );
    const ebeneToggle = Number(
      /z-index:\s*(\d+)/.exec(rule("collapseToggle"))?.[1],
    );

    expect(ebeneLeiste).toBeGreaterThan(0);
    expect(ebeneLeiste).toBeLessThan(ebeneToggle);
  });

  it("gibt der Leiste den Zeiger und nicht dem Rollen", () => {
    // Sonst nimmt der Browser die Geste an sich, bevor der Zug ankommt
    // (wie bei den POI-Karten, bug-023).
    expect(rule("divider")).toMatch(/touch-action:\s*none/);
    expect(rule("divider")).toMatch(/user-select:\s*none/);
  });
});
