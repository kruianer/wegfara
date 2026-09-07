import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob "Beginn" und "Ende" nebeneinander stehen,
// ohne sich zu ueberlappen (bug-019), wird deshalb direkt am CSS geprueft
// statt am gerenderten DOM (siehe poi-form.layout.test.ts, bug-016).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Der Rumpf der ersten Regel, deren Selektor genau so dasteht. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

describe('eckdaten-card Layout -- "Beginn" und "Ende" (bug-019)', () => {
  const css = readCss("../../../components/cards.module.css");

  it("laesst die beiden Spalten des Rasters nicht mitwachsen", () => {
    // minmax(0, 1fr) statt 1fr: eine Spalte waechst nie ueber ihren Anteil
    // hinaus, nur weil ihr Inhalt breiter ist.
    expect(rule(css, ".formFields")).toMatch(
      /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
  });

  it("nimmt dem Datumsfeld die eingebaute Breite seines Bedienteils", () => {
    // Ohne appearance: none leitet WebKit die Breite aus dem eingebauten
    // Kalender-Bedienteil ab und uebergeht width: 100%.
    const datum = rule(css, '.input[type="date"]');
    expect(datum).toMatch(/-webkit-appearance:\s*none/);
    expect(datum).toMatch(/[^-]appearance:\s*none/);
  });

  it("laesst das Datumsfeld auf die Breite seiner Spalte schrumpfen", () => {
    // min-width: auto ist die Voreinstellung und haelt ein Formularelement
    // auf der Breite seines Inhalts -- damit ragte "Beginn" ueber seine
    // Spalte hinaus und legte sich ueber "Ende".
    const datum = rule(css, '.input[type="date"]');
    expect(datum).toMatch(/min-width:\s*0/);
    expect(datum).toMatch(/max-width:\s*100%/);
  });

  it("haelt die inneren Teile des Datumsfelds ohne eigenen Innenabstand", () => {
    // Sie kaemen zum Innenabstand des Felds hinzu und schoeben den Wert
    // ueber dessen Rand.
    const innen =
      css.match(/\.input::-webkit-datetime-edit[^{]*{[^}]*}/)?.[0] ?? "";
    expect(innen).toMatch(/padding:\s*0/);
  });

  it("gibt dem Datumsfeld dieselbe Zeilenhoehe wie den Feldern daneben", () => {
    expect(rule(css, '.input[type="date"]')).toMatch(/line-height:\s*1\.25/);
  });
});

/**
 * Die Interessen der Praeferenzen (req-057) stehen als Feld von
 * Ankreuzfeldern in der Karte. Sie werden mit dem Finger bedient und muessen
 * deshalb die 44 px Tippziel einhalten (siehe delivery/stack.md,
 * Bildschirmbreiten, Regel 4).
 */
describe("eckdaten-card Layout -- Interessen (req-057)", () => {
  const css = readCss("../../../components/cards.module.css");

  it("gibt jeder Ankreuzzeile ein Tippziel von 44 px Hoehe", () => {
    expect(rule(css, ".interesse")).toMatch(/min-height:\s*44px/);
  });

  it("laesst die Interessen umbrechen, statt ueber den Rand zu ragen", () => {
    const feld = rule(css, ".interessen");
    expect(feld).toMatch(/display:\s*flex/);
    expect(feld).toMatch(/flex-wrap:\s*wrap/);
  });

  it("nimmt dem fieldset Rand und Innenabstand des Browsers", () => {
    // Ohne das saesse das Feld nicht buendig zu den uebrigen der Karte.
    const feldsatz = rule(css, ".praeferenzen");
    expect(feldsatz).toMatch(/border:\s*none/);
    expect(feldsatz).toMatch(/padding:\s*0/);
    // Ein fieldset traegt von Haus aus min-inline-size: min-content und
    // koennte sonst nicht auf die Breite der Karte schrumpfen.
    expect(feldsatz).toMatch(/min-inline-size:\s*0/);
  });
});
