import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Kanten eines Programmpunkts mit dem
// Finger zu treffen sind (req-046, Constraints) und ob der Umriss dem Zeiger
// nicht im Weg liegt, wird deshalb direkt am CSS geprueft statt am
// gerenderten DOM (siehe poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const css = readCss("./timeline-column.module.css");

function rule(selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/** Der Block einer Media Query samt der Regeln darin. */
function mediaBlock(condition: string) {
  const start = css.indexOf(`@media ${condition}`);
  return start < 0 ? "" : css.slice(start, css.indexOf("\n}", start));
}

describe("timeline-column Layout -- Kanten des Programmpunkts (req-046)", () => {
  it("legt je eine Greifflaeche an die obere und die untere Kante", () => {
    expect(rule("resizeHandleTop")).toMatch(/top:\s*0/);
    expect(rule("resizeHandleBottom")).toMatch(/bottom:\s*0/);
  });

  it("gibt beiden Kanten am Touch-Geraet eine mit dem Finger treffbare Hoehe", () => {
    // 8 px sind mit dem Finger nicht zu treffen (bug-017).
    expect(rule("resizeHandle")).toMatch(/height:\s*8px/);
    const grob = mediaBlock("(pointer: coarse)");
    expect(grob).toMatch(/\.resizeHandle\b/);
    expect(grob).toMatch(/height:\s*min\(20px,\s*25%\)/);
  });

  it("laesst zwischen beiden Kanten Flaeche zum Verschieben des Blocks", () => {
    // Je hoechstens ein Viertel: sonst bliebe bei kurzen Programmpunkten
    // nichts uebrig, was den Block als Ganzes zoege (req-046, Funktion).
    const anteil = Number(
      /min\(20px,\s*(\d+)%\)/.exec(mediaBlock("(pointer: coarse)"))?.[1],
    );
    expect(anteil * 2).toBeLessThan(100);
  });

  it("gibt der Kante den Zeiger und nicht dem Rollen", () => {
    expect(rule("resizeHandle")).toMatch(/touch-action:\s*none/);
  });
});

describe("timeline-column Layout -- Umriss beim Ziehen (req-046)", () => {
  it("laesst den Umriss keine Zeiger-Ereignisse annehmen", () => {
    // Sonst laege er zwischen Zeiger und Ablageflaeche, und weder der native
    // Zug noch der Finger faenden das Raster darunter.
    expect(rule("previewBlock")).toMatch(/pointer-events:\s*none/);
  });

  it("zeichnet ihn als Umriss und nicht als gefuellten Block", () => {
    expect(rule("previewBlock")).toMatch(/border:\s*2px dashed/);
  });
});
