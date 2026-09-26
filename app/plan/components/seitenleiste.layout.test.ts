import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- wo die Leiste steht, ob sie eingeklappt nur
// Symbole zeigt und ob sie mit dem Finger zu treffen ist, wird deshalb direkt
// am CSS geprueft statt am gerenderten DOM (siehe
// components/bereichsleiste.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Die Regel zu genau diesem Selektor -- am Zeilenanfang, nie eine Teilmenge. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(^|\\n)${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

/** Der Zahlenwert einer Eigenschaft in Pixeln. */
function px(regel: string, eigenschaft: string) {
  const treffer = regel.match(
    new RegExp(`${eigenschaft}:\\s*(-?[\\d.]+)px`, "i"),
  );
  return treffer ? Number(treffer[1]) : null;
}

/** Der Zahlenwert einer Eigenschaft ohne Einheit (z.B. z-index). */
function zahl(regel: string, eigenschaft: string) {
  const treffer = regel.match(
    new RegExp(`${eigenschaft}:\\s*(-?[\\d.]+)`, "i"),
  );
  return treffer ? Number(treffer[1]) : null;
}

describe("Seitenleiste Layout (req-077)", () => {
  const css = readCss("./seitenleiste.module.css");
  const planer = readCss("../plan-view.module.css");

  /**
   * Die Navigation liegt am linken Rand und nicht ueber dem Kopf: Leiste und
   * Inhalt stehen nebeneinander in einer Reihe, und die Leiste reicht von
   * oben bis unten.
   */
  it("stellt die Bereiche neben den Inhalt, nicht darüber", () => {
    const rahmen = rule(planer, ".rahmen");
    expect(rahmen).toMatch(/display:\s*flex/);
    // Eine Reihe ist die Vorgabe von flex -- eine Spalte waere wieder eine
    // Leiste ueber dem Inhalt.
    expect(rahmen).not.toMatch(/flex-direction:\s*column/);

    const tafel = rule(css, ".tafel");
    expect(tafel).toMatch(/top:\s*0/);
    expect(tafel).toMatch(/bottom:\s*0/);
    expect(tafel).toMatch(/left:\s*0/);
    expect(rule(css, ".tafel")).toMatch(/flex-direction:\s*column/);
  });

  /**
   * Der Zeitstrahl bekommt die Hoehe der alten Kopfleiste zurueck: ueber dem
   * Inhalt steht nichts mehr, was Hoehe kostet. Die alte Leiste war
   * mindestens 66px hoch (components/bereichsleiste.module.css) -- die
   * Seitenleiste gibt sich keine solche Hoehe, sie nimmt Breite.
   */
  it("nimmt dem Inhalt keine Höhe mehr weg", () => {
    expect(rule(css, ".tafel")).not.toMatch(/min-height/);
    expect(rule(planer, ".content")).not.toMatch(/margin-top|padding-top/);
    // Die Mindestbreite des Planers liegt seit req-077 an der Reihe, damit
    // Leiste und Inhalt zusammen darin bleiben, statt sie um die Leiste zu
    // ueberschreiten (Regel 1, stack.md).
    expect(rule(planer, ".rahmen")).toMatch(/min-width:\s*1180px/);
    expect(rule(planer, ".content")).toMatch(/min-width:\s*0/);
  });

  /**
   * Aufgeklappt liegt die Leiste ueber der Seite, statt sie
   * beiseitezuschieben: die Spur behaelt ihre Breite, nur die Tafel darauf
   * waechst -- und die liegt absolut darin.
   */
  it("legt sich beim Aufklappen über den Inhalt, statt ihn zu verschieben", () => {
    const spur = rule(css, ".spur");
    expect(spur).toMatch(/position:\s*relative/);
    expect(spur).toMatch(/width:\s*var\(--leiste-breite\)/);

    expect(rule(css, ".tafel")).toMatch(/position:\s*absolute/);
    expect(rule(css, ".offen .tafel")).toMatch(
      /width:\s*var\(--leiste-breite-offen\)/,
    );
    // Keine Regel im Aufklapp-Zustand ruehrt die Breite der Spur an.
    expect(rule(css, ".spur.offen")).toBe("");
    expect(rule(css, ".offen")).toBe("");
  });

  /**
   * Ein Tipp daneben klappt die Leiste zu, ohne darunter etwas zu oeffnen
   * (req-077): die Flaeche davor bedeckt die ganze Seite und liegt unter der
   * Leiste, aber ueber allem anderen.
   */
  it("legt vor die Seite eine Fläche, die den Tipp daneben abfängt", () => {
    const davor = rule(css, ".davor");
    expect(davor).toMatch(/position:\s*fixed/);
    expect(davor).toMatch(/inset:\s*0/);

    const zDavor = zahl(davor, "z-index");
    const zSpur = zahl(rule(css, ".spur"), "z-index");
    expect(zDavor).not.toBeNull();
    expect(zSpur).toBeGreaterThan(zDavor!);
  });

  /**
   * Eingeklappt zeigt die Leiste nur Symbole; aufgeklappt stehen die
   * Beschriftungen daneben. Im Dokument bleibt der Text beide Male stehen --
   * fuer Vorleseprogramme (req-077, Constraints).
   */
  it("versteckt die Beschriftungen eingeklappt und zeigt sie aufgeklappt", () => {
    const label = rule(css, ".label");
    expect(label).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(label).toMatch(/width:\s*1px/);
    expect(label).toMatch(/height:\s*1px/);

    const offen = rule(css, ".offen .label");
    expect(offen).toMatch(/position:\s*static/);
    expect(offen).toMatch(/clip-path:\s*none/);
    expect(offen).toMatch(/width:\s*auto/);
  });

  it("versteckt Name und Slogan eingeklappt genauso", () => {
    expect(rule(css, ".marke")).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(rule(css, ".offen .marke")).toMatch(/clip-path:\s*none/);
  });

  /**
   * Jedes Symbol ist mit dem Finger zu treffen: mindestens 44x44 px
   * (stack.md, Bildschirmbreiten, Regel 4). In der Breite bleibt nach
   * Innenabstand und Rand der Leiste genau so viel uebrig.
   */
  it("gibt jedem Symbol mindestens 44 x 44 px", () => {
    const eintrag = rule(css, ".eintrag");
    expect(eintrag).toMatch(/min-height:\s*44px/);
    expect(eintrag).toMatch(/box-sizing:\s*border-box/);

    const schalter = rule(css, ".schalter");
    expect(schalter).toMatch(/width:\s*44px/);
    expect(schalter).toMatch(/height:\s*44px/);
    expect(schalter).toMatch(/box-sizing:\s*border-box/);

    const spur = rule(css, ".spur");
    const tafel = rule(css, ".tafel");
    const breite = px(spur, "--leiste-breite");
    const innen = px(tafel, "padding");
    const rand = px(tafel, "border-right");
    expect(tafel).toMatch(/box-sizing:\s*border-box/);
    expect(breite).not.toBeNull();
    expect(innen).not.toBeNull();
    expect(rand).not.toBeNull();
    expect(breite! - 2 * innen! - rand!).toBeGreaterThanOrEqual(44);
  });
});
