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
    for (const klasse of ["route", "routePrimary", "routeSecondary"]) {
      const regelText = regel(css, klasse);
      expect(regelText).toMatch(/min-height:\s*44px/);
      expect(regelText).toMatch(/min-width:\s*44px/);
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
});
