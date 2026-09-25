import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HOUR_HEIGHT_PX } from "@/lib/plan/timeline-grid";

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

  it("haelt die Zahl am rechten Ende und laesst die Beschriftung weichen", () => {
    // Der Zeitpuffer steht immer an derselben Stelle (req-073); schmal wird
    // es, kuerzt sich die Beschriftung neben ihm.
    expect(rule("zeitpuffer")).toMatch(/flex:\s*none/);
    expect(rule("transferBeschriftung")).toMatch(/flex:\s*1/);
    expect(rule("transferBeschriftung")).toMatch(/text-overflow:\s*ellipsis/);
  });

  it("laesst die beiden Farben nur die Farbe unterscheiden", () => {
    // Stuende die Stelle in einer der beiden Regeln, spraenge die Zahl
    // zwischen gruen und rot (req-073).
    for (const selector of ["zeitpufferPos", "zeitpufferNeg"]) {
      const eigenschaften = [...rule(selector).matchAll(/([a-z-]+)\s*:/g)].map(
        (treffer) => treffer[1],
      );
      expect(eigenschaften).toEqual(["color"]);
    }
    expect(rule("zeitpufferPos")).toMatch(/color:\s*var\(--pos\)/);
    expect(rule("zeitpufferNeg")).toMatch(/color:\s*var\(--neg\)/);
  });

  it("laesst die Zahl auch im flachsten Block ganz stehen", () => {
    // Ein Block, dessen Luecke kurz ist, misst nur TRANSFER_MIN_HEIGHT_PX.
    // Was darueber hinausgeht, schneidet `overflow: hidden` ab -- Rahmen,
    // Innenabstand und Zeilenhoehe muessen deshalb zusammen hineinpassen
    // (req-073).
    const mindesthoehe = Number(
      /TRANSFER_MIN_HEIGHT_PX = (\d+)/.exec(
        readCss("./timeline-column.tsx"),
      )?.[1],
    );
    const block = rule("transferBlock");
    const masse = (eigenschaft: string) =>
      Number(new RegExp(`${eigenschaft}:\\s*([\\d.]+)px`).exec(block)?.[1]);

    expect(block).toMatch(/box-sizing:\s*border-box/);
    expect(mindesthoehe).toBeGreaterThan(0);
    expect(masse("line-height")).toBeGreaterThanOrEqual(masse("font-size"));
    expect(
      2 * masse("padding") + 2 * masse("border") + masse("line-height"),
    ).toBeLessThanOrEqual(mindesthoehe);
  });

  it("laesst die Zahl auch im schmalen Block nicht umbrechen", () => {
    expect(rule("zeitpuffer")).toMatch(/white-space:\s*nowrap/);
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

/**
 * Die Nummer des POI am Programmpunkt (req-074): sie steht vor dem Titel,
 * verdraengt ihn nicht und bleibt auch im flachsten Block ganz sichtbar.
 */
describe("timeline-column Layout -- Nummer am Programmpunkt (req-074)", () => {
  /** Ein Pixelmass aus einer Regel -- etwa die Mindesthoehe des Blocks. */
  function mass(eigenschaft: string, regel: string): number {
    return Number(
      new RegExp(`${eigenschaft}:\\s*([\\d.]+)px`).exec(regel)?.[1],
    );
  }

  it("haelt die Nummer vorn und laesst den Titel daneben umbrechen", () => {
    expect(rule("activityTitle")).toMatch(/display:\s*flex/);
    // Die Nummer schrumpft nicht und bricht nicht um -- sonst stuende die Zahl
    // bei langem Titel auf zwei Zeilen oder verschwaende ganz.
    expect(rule("activityNumber")).toMatch(/flex:\s*none/);
    expect(rule("activityNumber")).toMatch(/white-space:\s*nowrap/);
    // Der Titel nimmt den Rest der Zeile und bricht notfalls im Wort um,
    // statt den Block zu sprengen (stack.md, Bildschirmbreiten, Regel 1).
    expect(rule("activityTitleText")).toMatch(/min-width:\s*0/);
    expect(rule("activityTitleText")).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("kuerzt den langen Titel nicht weg", () => {
    // Die Nummer steht zusaetzlich, nicht an seiner Stelle (req-074): ein
    // "..." statt des Textes waere kein lesbarer Titel.
    expect(rule("activityTitleText")).not.toMatch(/text-overflow/);
    expect(rule("activityTitle")).not.toMatch(/text-overflow/);
  });

  it("gibt der Nummer eine Schriftgroesse, die zu lesen ist", () => {
    // Nicht kleiner als die uebrige Kleinschrift des Blocks -- und nicht in
    // einer der beiden leisesten Textstufen (vgl. bug-051).
    const nummer = rule("activityNumber");
    const groesse = Number(/font-size:\s*([\d.]+)px/.exec(nummer)?.[1]);
    expect(groesse).toBeGreaterThanOrEqual(11);
    expect(nummer).toMatch(/color:\s*var\(--text-2\)/);
  });

  it("laesst die Nummer auch im flachsten Block ganz stehen", () => {
    // Ein Programmpunkt von einer Viertelstunde waere nur 12px hoch. Was
    // ueber die Blockhoehe hinausgeht, schneidet `overflow: hidden` ab --
    // Rahmen, Innenabstand und Zeilenhoehe muessen deshalb zusammen in die
    // Mindesthoehe passen (wie am Transfer-Block, req-073).
    const block = rule("activityBlock");
    const mindesthoehe = mass("min-height", block);

    expect(block).toMatch(/box-sizing:\s*border-box/);
    expect(mindesthoehe).toBeGreaterThan(0);
    expect(
      2 * mass("padding", block) +
        2 * mass("border", block) +
        mass("line-height", rule("activityTitle")),
    ).toBeLessThanOrEqual(mindesthoehe);
  });

  it("zeichnet den flachsten Block dabei nicht hoeher als eine halbe Stunde", () => {
    // Die Mindesthoehe verschiebt nichts und ueberdeckt nichts, was weiter
    // als eine halbe Stunde entfernt liegt.
    expect(mass("min-height", rule("activityBlock"))).toBeLessThanOrEqual(
      HOUR_HEIGHT_PX / 2,
    );
  });
});

/**
 * Die Nummer bei den drei Bildschirmbreiten aus stack.md (req-074): sie haengt
 * an keiner Media Query, und die Spalte ist fest breit -- bei 375, 768 und
 * 1280 px ist sie deshalb dieselbe. Unter 1180 px zeigt der Planer statt der
 * Spalten seinen Hinweis (siehe plan-view.test.tsx).
 */
describe("timeline-column Layout -- Nummer bei jeder Breite (req-074)", () => {
  it("laesst keine Media Query an Nummer und Titelzeile", () => {
    for (const block of css.match(/@media[^{]*{[\s\S]*?\n}/g) ?? []) {
      expect(block).not.toMatch(/\.activityNumber\b/);
      expect(block).not.toMatch(/\.activityTitle\b/);
    }
  });

  it("haelt die Spalte fest breit", () => {
    // Sie schrumpft nicht mit dem Fenster -- die Nummer wird nie enger.
    expect(rule("column")).toMatch(/width:\s*412px/);
    expect(rule("column")).toMatch(/flex:\s*none/);
  });
});
