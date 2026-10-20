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
 * Die Nummer des POI auf der Karte (req-074): sie steht vor dem Namen,
 * verdraengt ihn nicht und bricht nicht um.
 */
describe("unplanned-column Layout -- Nummer des POI (req-074)", () => {
  it("haelt die Nummer vorn und laesst den Namen daneben umbrechen", () => {
    expect(rule("nameLine")).toMatch(/display:\s*flex/);
    expect(rule("number")).toMatch(/flex:\s*none/);
    expect(rule("number")).toMatch(/white-space:\s*nowrap/);
    expect(rule("name")).toMatch(/min-width:\s*0/);
    expect(rule("name")).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("kuerzt den langen Namen nicht weg", () => {
    // Die Nummer steht zusaetzlich, nicht an seiner Stelle (req-074).
    expect(rule("name")).not.toMatch(/text-overflow/);
  });

  it("gibt der Nummer eine Schriftgroesse, die zu lesen ist", () => {
    // Nicht in einer der beiden leisesten Textstufen (vgl. bug-051).
    const nummer = rule("number");
    expect(
      Number(/font-size:\s*([\d.]+)px/.exec(nummer)?.[1]),
    ).toBeGreaterThanOrEqual(11);
    expect(nummer).toMatch(/color:\s*var\(--text-2\)/);
  });
});

/**
 * Die Nummer bei den drei Bildschirmbreiten aus stack.md (req-074): sie haengt
 * an keiner Media Query, und die Spalte ist fest breit -- bei 375, 768 und
 * 1280 px ist sie deshalb dieselbe.
 */
describe("unplanned-column Layout -- Nummer bei jeder Breite (req-074)", () => {
  it("laesst keine Media Query an Nummer und Namenszeile", () => {
    for (const block of css.match(/@media[^{]*{[\s\S]*?\n}/g) ?? []) {
      expect(block).not.toMatch(/\.number\b/);
      expect(block).not.toMatch(/\.nameLine\b/);
    }
  });

  it("haelt die Spalte fest breit", () => {
    expect(rule("column")).toMatch(/width:\s*294px/);
    expect(rule("column")).toMatch(/flex:\s*none/);
  });
});

/**
 * Filter und Zaehler bei den drei Bildschirmbreiten aus stack.md (req-083):
 * 375 px (iPhone), 768 px (iPad hochkant) und 1280 px (Laptop). Wie die
 * Nummer (req-074) haengen sie an keiner Media Query, und die Spalte ist
 * fest breit -- bedienbar sind sie deshalb bei allen drei Breiten gleich.
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
