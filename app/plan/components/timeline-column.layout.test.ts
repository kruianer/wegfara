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

describe("timeline-column Layout -- sichtbarer Anfasser (bug-022)", () => {
  it("zeichnet in jede Kante einen sichtbaren Strich", () => {
    // Ohne ihn ist dem Block nicht anzusehen, wo er sich greifen laesst.
    const grip = rule("resizeGrip");
    expect(grip).toMatch(/background:\s*var\(--text-3\)/);
    expect(grip).toMatch(/height:\s*3px/);
    expect(grip).toMatch(/width:\s*26px/);
  });

  it("legt ihn in die Mitte der Kante -- neben das Kreuz zum Entfernen", () => {
    // Das Kreuz sitzt oben rechts (req-039); mittig kommen sich beide nicht
    // in die Quere.
    const grip = rule("resizeGrip");
    expect(grip).toMatch(/left:\s*50%/);
    expect(grip).toMatch(/transform:\s*translate\(-50%, -50%\)/);
  });

  it("laesst den Strich keine Zeiger-Ereignisse annehmen", () => {
    // Die gehoeren der Greifflaeche um ihn herum, die groesser ist als er.
    expect(rule("resizeGrip")).toMatch(/pointer-events:\s*none/);
  });

  it("hebt den gegriffenen Anfasser in der Akzentfarbe hervor", () => {
    expect(rule("resizeGripGegriffen")).toMatch(/background:\s*var\(--acc\)/);
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

describe("timeline-column Layout -- Transfer in der Luecke (req-052)", () => {
  /**
   * Dieselbe Regel wie `rule`, aber ohne die Media Queries: `.addTransfer`
   * steht in beiden, und gemeint ist hier die des Zeigergeraets.
   */
  function basisRegel(selector: string) {
    const ohneMedia = css.replace(/@media[^{]*{[\s\S]*?\n}/g, "");
    return ohneMedia.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
  }

  it("zeichnet den Transfer als gestrichelten Block", () => {
    expect(rule("transferBlock")).toMatch(/border:\s*1px dashed/);
  });

  it("zeigt das „+“ erst beim Draufzeigen auf die Luecke", () => {
    expect(basisRegel("addTransfer")).toMatch(/opacity:\s*0/);
    expect(css).toMatch(/\.luecke:hover \.addTransfer[\s\S]*?opacity:\s*1/);
  });

  it("laesst die Luecke selbst keine Zeiger-Ereignisse annehmen", () => {
    // Sonst laege sie zwischen Zeiger und Raster, und ein POI liesse sich in
    // der Luecke nicht mehr ablegen (req-039).
    expect(basisRegel("luecke")).toMatch(/pointer-events:\s*none/);
    expect(basisRegel("addTransfer")).toMatch(/pointer-events:\s*auto/);
  });

  it("gibt dem „+“ am Touch-Geraet ein mit dem Finger treffbares Mass", () => {
    // Dort gibt es kein Draufzeigen -- es steht sichtbar da und misst
    // 44 x 44 px (siehe stack.md, Bildschirmbreiten).
    const grob = mediaBlock("(pointer: coarse)");
    expect(grob).toMatch(/\.addTransfer\b/);
    expect(grob).toMatch(/width:\s*44px/);
    expect(grob).toMatch(/height:\s*44px/);
    expect(grob).toMatch(/opacity:\s*1/);
  });
});
