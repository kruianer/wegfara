import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Die Groesse des Tippziels wird deshalb direkt am CSS
// geprueft (siehe app/go/components/activity-card.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

// Jede Klasse steckt in einer gemeinsamen Regel (Kurzschreibweise per Komma)
// UND einer eigenen -- die einfache Variante aus
// activity-card.layout.test.ts findet nur Einzelselektoren, deshalb hier
// ueber die Selektorliste jedes Blocks, und alle Treffer zusammengefasst.
function regel(css: string, klasse: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .filter((block) => {
      const trennstelle = block.indexOf("{");
      if (trennstelle === -1) return false;
      const selektoren = block
        .slice(0, trennstelle)
        .split(",")
        .map((s) => s.trim());
      return selektoren.includes(`.${klasse}`);
    })
    .map((block) => block.slice(block.indexOf("{") + 1))
    .join("\n");
}

/**
 * bug-062: am Reisetag stehen "Ab hier" und "Route" nebeneinander neben dem
 * Transfer-Text -- bei 375 px (stack.md, Bildschirmbreiten) muss das ohne
 * Ueberlauf gehen, notfalls durch Umbruch (Regel 1), und beide bleiben
 * Tippziele von mindestens 44x44 px (Regel 4).
 */
describe("Transfer-Knoepfe im Begleiter bei 375, 768 und 1280 px (bug-062)", () => {
  const css = readCss("./transfer-row.module.css");

  it("laesst die Zeile umbrechen, statt die Knoepfe hinauszudruecken (Regel 1)", () => {
    expect(regel(css, "row")).toMatch(/flex-wrap:\s*wrap/);
    expect(regel(css, "buttons")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("haelt jeden Knopf als Tippziel von mindestens 44x44 px (Regel 4)", () => {
    // bug-070: die 44 px traegt eine unsichtbare Flaeche ueber der Pille,
    // nicht mehr die sichtbare Pille selbst.
    for (const klasse of ["route", "routePrimary", "routeSecondary"]) {
      expect(regel(css, klasse)).toMatch(/position:\s*relative/);
      const flaeche = regel(css, `${klasse}::after`);
      expect(flaeche).toMatch(/content:\s*""/);
      expect(flaeche).toMatch(/position:\s*absolute/);
      expect(flaeche).toMatch(/min-height:\s*44px/);
      expect(flaeche).toMatch(/min-width:\s*44px/);
      expect(flaeche).toMatch(/width:\s*100%/);
      expect(flaeche).toMatch(/height:\s*100%/);
    }
  });

  it('hebt "Ab hier" gegenueber der kleineren Route hervor', () => {
    const primary = regel(css, "routePrimary");
    const secondary = regel(css, "routeSecondary");
    const primaryGroesse = Number(
      primary.match(/font-size:\s*([\d.]+)px/)?.[1],
    );
    const secondaryGroesse = Number(
      secondary.match(/font-size:\s*([\d.]+)px/)?.[1],
    );

    expect(primaryGroesse).toBeGreaterThan(secondaryGroesse);
    expect(primary).toMatch(/background:\s*var\(--acc\)/);
  });

  /**
   * bug-070: "Ab hier" und "Route" waren durch min-height: 44px sichtbar
   * hoeher als die uebrigen Pillen. Sie sind jetzt so flach wie der
   * Buchungsknopf auf der Kachel.
   */
  it('zeigt "Ab hier" und "Route" so hoch wie den Buchungsknopf (bug-070)', () => {
    const buchung = regel(readCss("./booking-button.module.css"), "pill");
    const buchungPolster = buchung.match(/padding:\s*(\d+)px/)?.[1];

    for (const klasse of ["route", "routePrimary", "routeSecondary"]) {
      const regelText = regel(css, klasse);
      expect(regelText).not.toMatch(/min-height/);
      expect(regelText).not.toMatch(/(^|[^-])height:/);
      expect(regelText.match(/padding:\s*(\d+)px/)?.[1]).toBe(buchungPolster);
      // feste Zeilenhoehe: die drei Schriftgroessen ergeben dieselbe Hoehe
      expect(regelText).toMatch(/line-height:\s*14px/);
    }
  });
});
