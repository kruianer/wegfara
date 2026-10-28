import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob der gegriffene POI wirklich anders aussieht
// (bug-023), wird deshalb direkt am CSS geprueft statt am gerenderten DOM
// (siehe timeline-column.layout.test.ts, bug-022).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const css = readCss("./unplanned-column.module.css");

function rule(selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("unplanned-column Layout -- gegriffener POI (bug-023)", () => {
  it("faerbt den Rahmen der gegriffenen Karte in die Akzentfarbe", () => {
    // Ungegriffen traegt die Karte den unauffaelligen Rahmen --bd; erst der
    // Wechsel zeigt, dass der POI am Finger haengt.
    expect(rule("card")).toMatch(/border:\s*1px solid var\(--bd\)/);
    expect(rule("gegriffen")).toMatch(/border-color:\s*var\(--acc\)/);
  });

  it("laesst den Finger auf der Karte nichts auswaehlen", () => {
    // Sonst legt das iPad beim Liegenbleiben die Textauswahl samt Lupe ueber
    // die Karte, statt sie zu greifen.
    const ziehbar = rule("draggable");
    expect(ziehbar).toMatch(/user-select:\s*none/);
    expect(ziehbar).toMatch(/-webkit-touch-callout:\s*none/);
  });

  it("laesst die Liste weiterhin mit dem Finger rollen", () => {
    // Nach oben und unten rollt die Liste, solange nicht gegriffen ist --
    // gesperrt wird das Rollen erst mit dem Zug (siehe pointer-drag.ts).
    expect(rule("draggable")).toMatch(/touch-action:\s*pan-y/);
  });
});

/**
 * Die Nummer des POI auf der Karte (req-074). Seit req-099 liegt sie oben
 * links auf dem Bild, wie in der POI-Liste (req-097) -- sie bricht nicht um
 * und ist zu lesen.
 */
describe("unplanned-column Layout -- Nummer des POI (req-074, req-099)", () => {
  it("legt die Nummer oben links auf das Bild, ohne Umbruch", () => {
    expect(rule("bild")).toMatch(/position:\s*relative/);
    const nummer = rule("nummer");
    expect(nummer).toMatch(/position:\s*absolute/);
    expect(nummer).toMatch(/top:\s*3px/);
    expect(nummer).toMatch(/left:\s*3px/);
    expect(nummer).toMatch(/white-space:\s*nowrap/);
  });

  it("laesst den langen Namen umbrechen, statt aus der Karte zu ragen", () => {
    const name = rule("name");
    expect(name).toMatch(/overflow-wrap:\s*anywhere/);
    // Hoechstens zwei Zeilen (Entwurf req-099); der volle Name steht im
    // title der Zeile.
    expect(name).toMatch(/-webkit-line-clamp:\s*2/);
    expect(rule("mitte")).toMatch(/min-width:\s*0/);
  });

  it("gibt der Nummer eine Schriftgroesse, die zu lesen ist", () => {
    const nummer = rule("nummer");
    expect(
      Number(/font-size:\s*([\d.]+)px/.exec(nummer)?.[1]),
    ).toBeGreaterThanOrEqual(11);
  });
});

/**
 * Die Karte (req-099): Bild 78 x 58 px, drei Spalten, und nicht hoeher als
 * noetig.
 */
describe("unplanned-column Layout -- Karte mit Bild (req-099)", () => {
  it("teilt die Karte in Bild, Mitte und rechte Spalte", () => {
    expect(rule("card")).toMatch(/display:\s*grid/);
    expect(rule("card")).toMatch(
      /grid-template-columns:\s*78px minmax\(0, 1fr\) auto/,
    );
  });

  it("zeichnet das Bild 78 x 58 px", () => {
    expect(rule("bild")).toMatch(/width:\s*78px/);
    expect(rule("bild")).toMatch(/height:\s*58px/);
  });

  it("legt den Typ als Band unten ueber die ganze Breite", () => {
    const band = rule("typBand");
    expect(band).toMatch(/bottom:\s*0/);
    expect(band).toMatch(/left:\s*0/);
    expect(band).toMatch(/right:\s*0/);
    expect(band).toMatch(/var\(--typ\)/);
  });

  it("laesst das Weltkulturerbe leuchten und leise atmen, ausser bei reduzierter Bewegung", () => {
    expect(rule("bildWelterbe")).toMatch(/box-shadow/);
    expect(css).toMatch(/\.bildWelterbe \.typBand\s*{[^}]*animation:/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{\s*\.bildWelterbe \.typBand\s*{\s*animation:\s*none/,
    );
  });

  it("zeichnet den unverplanten POI mit gestricheltem Rahmen", () => {
    expect(rule("planCountNull")).toMatch(/border:\s*1px dashed/);
  });

  it("macht die Karte nicht hoeher als Bild, Zeile darunter und Rand", () => {
    // 58 px Bild + 3 px Abstand + 14 px Zeile = 75 px Inhalt (Entwurf).
    expect(rule("unterbild")).toMatch(/height:\s*14px/);
    expect(rule("bildspalte")).toMatch(/gap:\s*3px/);
    expect(rule("card")).toMatch(/padding:\s*7px/);
  });
});

/**
 * Die Karte bei jeder Breite: die Spalte ist fest breit, und keine Regel der
 * Karte haengt an einer Media Query (req-074, req-083).
 */
describe("unplanned-column Layout -- Karte bei jeder Breite (req-074)", () => {
  it("laesst keine Media Query an Nummer, Namen oder Zaehler", () => {
    for (const block of css.match(/@media[^{]*{[\s\S]*?\n}/g) ?? []) {
      expect(block).not.toMatch(/\.nummer\b/);
      expect(block).not.toMatch(/\.name\b/);
      expect(block).not.toMatch(/\.planCount\b/);
    }
  });

  it("haelt die Spalte fest breit -- die Breite kommt aus dem Token (req-099)", () => {
    expect(rule("column")).toMatch(/width:\s*var\(--spalte-poi-auswahl\)/);
    expect(rule("column")).toMatch(/flex:\s*none/);
  });
});

/**
 * Filter und Zaehler (req-083): der Zaehler ist zu lesen, der Filter ein
 * volles Tippziel, die Kopfzeile bricht um, statt etwas zu verdraengen.
 */
describe("unplanned-column Layout -- Filter und Zaehler bei jeder Breite (req-083)", () => {
  it("laesst keine Media Query an Kopfzeile, Filter oder Zaehler", () => {
    for (const block of css.match(/@media[^{]*{[\s\S]*?\n}/g) ?? []) {
      expect(block).not.toMatch(/\.header\b/);
      expect(block).not.toMatch(/\.filterSelect\b/);
      expect(block).not.toMatch(/\.planCount\b/);
    }
  });

  it("gibt dem Filter mindestens 44px Trefferflaeche (wie die Filter der POI-Liste, bug-024)", () => {
    const filterSelect = rule("filterSelect");
    expect(filterSelect).toMatch(/min-height:\s*44px/);
    expect(filterSelect).toMatch(/box-sizing:\s*border-box/);
  });

  it("laesst Titel und Filter bei schmaler Spalte umbrechen, statt sie zu verdraengen (Regel 1)", () => {
    const header = rule("header");
    expect(header).toMatch(/display:\s*flex/);
    expect(header).toMatch(/flex-wrap:\s*wrap/);
  });

  it("gibt dem Zaehler eine Schriftgroesse, die zu lesen ist (vgl. bug-051)", () => {
    const planCount = rule("planCount");
    expect(
      Number(/font-size:\s*([\d.]+)px/.exec(planCount)?.[1]),
    ).toBeGreaterThanOrEqual(11);
  });
});

/**
 * Breite und Zuklappen (req-099): die Breiten stehen als Token an einer
 * Stelle (lib/design/stil.ts), der Griff ist ein volles Tippziel.
 */
describe("unplanned-column Layout -- zuklappbar (req-099)", () => {
  it("nennt keine eigene Breite mehr -- die 294 px sind ersetzt", () => {
    expect(css).not.toMatch(/\b294px\b/);
    expect(css).not.toMatch(/\b340px\b/);
    expect(rule("zu")).toMatch(/width:\s*var\(--spalte-poi-auswahl-zu\)/);
  });

  it("traegt keinen Rand, der die Spalte breiter machte als ihr Token", () => {
    expect(rule("column")).not.toMatch(/border(-right)?:/);
    expect(rule("column")).toMatch(/box-shadow:\s*inset -1px 0 0/);
  });

  it("gibt dem Griff 44 x 44 px Trefferflaeche", () => {
    const griff = rule("griff");
    expect(griff).toMatch(/width:\s*44px/);
    expect(griff).toMatch(/min-height:\s*44px/);
    expect(griff).toMatch(/box-sizing:\s*border-box/);
  });

  it("stellt den Namen im Streifen senkrecht", () => {
    expect(rule("senkrecht")).toMatch(/writing-mode:\s*vertical-rl/);
  });
});
