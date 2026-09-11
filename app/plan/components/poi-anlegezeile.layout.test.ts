import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- die Bildschirmregeln aus delivery/stack.md
// werden deshalb direkt am CSS geprueft statt am gerenderten DOM (siehe
// app/go/go-view.layout.test.ts, bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * Die Anlegezeile (req-060) traegt ein Eingabefeld und zwei Schaltflaechen
 * nebeneinander. Anders als das Wunschfeld der KI-Suche zuvor ist das Feld
 * immer bedienbar -- damit gilt fuer es die Tippziel-Regel aus
 * delivery/stack.md (Regel 4, vgl. bug-024).
 */
describe("poi-anlegezeile Layout — Tippziele (req-060)", () => {
  const css = readCss("./poi-anlegezeile.module.css");

  it("gibt dem Eingabefeld mindestens 44px Trefferflaeche", () => {
    // Gezeichnet wird darin weniger -- siehe bug-039 weiter unten.
    const feld = rule(css, "input");
    expect(feld).toMatch(/min-height:\s*44px/);
    expect(feld).toMatch(/box-sizing:\s*border-box/);
  });

  it('gibt "Mit KI suchen" und "POI anlegen" mindestens 44px Trefferflaeche', () => {
    const knoepfe = css.match(/\.aiButton,\s*\.createButton\s*{[^}]*}/)?.[0];
    expect(knoepfe).toMatch(/min-height:\s*44px/);
    expect(knoepfe).toMatch(/box-sizing:\s*border-box/);
  });

  it("gibt jedem Ortsvorschlag mindestens 44px Hoehe", () => {
    const vorschlag = rule(css, "suggestion");
    expect(vorschlag).toMatch(/min-height:\s*44px/);
    expect(vorschlag).toMatch(/box-sizing:\s*border-box/);
  });

  it("laesst die Zeile umbrechen, statt aus der Spalte zu ragen", () => {
    const controls = rule(css, "controls");
    expect(controls).toMatch(/display:\s*flex/);
    expect(controls).toMatch(/flex-wrap:\s*wrap/);
    // Ohne min-width am Feld draengt es die Knoepfe bei 375px hinaus.
    expect(rule(css, "input")).toMatch(/min-width:/);
  });

  it("legt die Vorschlagsliste ueber den Filter, statt ihn zu verschieben", () => {
    expect(rule(css, "controls")).toMatch(/position:\s*relative/);
    const vorschlaege = rule(css, "suggestions");
    expect(vorschlaege).toMatch(/position:\s*absolute/);
    expect(vorschlaege).toMatch(/z-index:/);
  });
});

/**
 * Dieselbe Ursache wie bug-025 und bug-028, an der Anlegezeile (bug-039):
 * die 44px aus bug-024 machten Feld und Knoepfe sichtbar zu hoch. Sie werden
 * jetzt in der gewohnten Hoehe gezeichnet -- alle Bedienelemente der
 * Anlegezeile und der Filterzeile darunter wirken damit als eine Reihe (die
 * Filterzeile prueft poi-list.layout.test.ts).
 */
describe("poi-anlegezeile Layout — sichtbare Groesse der Zeile (bug-039)", () => {
  const css = readCss("./poi-anlegezeile.module.css");

  // Die gewohnte Hoehe eines Bedienelements: zweimal 8px Innenabstand um
  // eine Zeile 11.5px-Text -- das Mass, an dem sich diese Zeile ausrichtet.
  const GEWOHNTE_HOEHE = 30;

  /** Der unsichtbare Rand, der allein die Trefferflaeche traegt. */
  function randVon(regel: string): number {
    return Number(
      regel.match(/border:\s*(\d+(?:\.\d+)?)px solid transparent/)?.[1],
    );
  }

  /** Die gemeinsame Regel der beiden Knoepfe. */
  const beideKnoepfe =
    css.match(/\.aiButton,\s*\.createButton\s*{[^}]*}/)?.[0] ?? "";

  /**
   * Die Regel zu genau diesem Selektor -- nicht die, in der er mit einem
   * anderen zusammensteht: ".createButton" kommt in beiden vor.
   */
  function eigeneRegel(selector: string) {
    return (
      css.match(new RegExp(`(?<!,\\s*)\\.${selector}\\s*{[^}]*}`))?.[0] ?? ""
    );
  }

  it("zeichnet das Eingabefeld in der gewohnten Hoehe", () => {
    const feld = rule(css, "input");
    expect(44 - 2 * randVon(feld)).toBe(GEWOHNTE_HOEHE);
    // Ohne padding-box liefe der Hintergrund unter den unsichtbaren Rand und
    // das Feld saehe wieder 44px hoch aus; der sichtbare 1px-Rand wird nach
    // innen gezeichnet, weil der echte Rand die Trefferflaeche traegt.
    expect(feld).toMatch(/padding-box/);
    expect(feld).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(feld).not.toMatch(/border:\s*1px solid var/);
  });

  it('zeichnet "Mit KI suchen" und "POI anlegen" in der gewohnten Hoehe', () => {
    expect(44 - 2 * randVon(beideKnoepfe)).toBe(GEWOHNTE_HOEHE);
    // Der farbige Knopf hat keinen sichtbaren Rand, der andere einen als
    // inneren Schatten -- beide enden mit ihrer Flaeche an der Innenkante.
    expect(eigeneRegel("aiButton")).toMatch(
      /background:\s*var\(--acc\) padding-box/,
    );
    const anlegen = eigeneRegel("createButton");
    expect(anlegen).toMatch(/padding-box/);
    expect(anlegen).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(anlegen).not.toMatch(/border:\s*1px solid var/);
  });

  it("faerbt den ueberfahrenen Knopf nur in seinem sichtbaren Teil", () => {
    const hover = rule(css, "createButton:hover:not\\(:disabled\\)");
    expect(hover).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(hover).not.toMatch(/border-color:/);
  });

  it("traegt den unsichtbaren Rand nur oben und unten", () => {
    // Waagerecht ist er nicht noetig -- Feld und Beschriftungen sind ohnehin
    // breiter als 44px -- und er zoege die Zeile auseinander.
    for (const regel of [rule(css, "input"), beideKnoepfe]) {
      expect(regel).toMatch(/border-left-width:\s*0/);
      expect(regel).toMatch(/border-right-width:\s*0/);
    }
  });

  it("addiert die Abstaende um die Zeile nicht auf ihren Rand", () => {
    const rand = randVon(rule(css, "input"));
    const controls = rule(css, "controls");
    // Waagerecht bleibt der gewohnte Abstand, senkrecht kommt er beim
    // Umbruch aus dem unsichtbaren Rand der Bedienelemente selbst.
    expect(controls).toMatch(/gap:\s*0 8px/);
    // Der negative Abstand nach unten zehrt denselben Rand auf: er faellt in
    // leeren Raum und schiebt kein Bedienelement unter ein anderes.
    expect(controls).toMatch(new RegExp(`margin-bottom:\\s*-${rand}px`));
    // Sichtbar bleiben damit die gewohnten rund 13px bis zur Filterzeile:
    // 7px Abstand plus deren eigener unsichtbarer Rand von 7px.
    expect(rule(css, "bar")).toMatch(new RegExp(`margin:\\s*0 22px ${rand}px`));
  });
});
