import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- geprueft wird am Stylesheet (siehe
// eckdaten-card.layout.test.ts).
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

/**
 * Der Bereich "Drucken" (req-103) bei 1024, 1280 und 1920 px: das Blatt ist
 * 210 mm breit und passt neben die Seitenleiste; wo der Bereich schmaler ist,
 * wird die Vorschau kleiner gezeigt, statt ueber den Rand zu stehen.
 */
describe("Bereich Drucken -- Layout (req-103)", () => {
  const css = readCss("./drucken-view.module.css");

  it("scrollt fuer sich und laesst sich nicht seitlich verschieben", () => {
    const bereich = rule(css, ".bereich");
    expect(bereich).toMatch(/overflow-y:\s*auto/);
    expect(bereich).toMatch(/overflow-x:\s*hidden/);
    expect(bereich).toMatch(/min-width:\s*0/);
  });

  it("zeigt die Vorschau in einem schmalen Bereich kleiner", () => {
    expect(css).toMatch(/container-type:\s*inline-size/);
    expect(css).toMatch(
      /@container \(max-width: 820px\)\s*{\s*\.vorschau\s*{\s*zoom:\s*0\.85/,
    );
  });

  it("gibt dem Knopf zum Drucken und dem Verweis das Mass eines Tippziels", () => {
    expect(rule(css, ".druckKnopf")).toMatch(/min-height:\s*var\(--tippziel\)/);
    expect(rule(css, ".adresse")).toMatch(/min-height:\s*var\(--tippziel\)/);
  });

  it("laesst beim Drucken den Kopf weg", () => {
    const druck = css.slice(css.indexOf("@media print"));
    expect(druck).toMatch(/\.kopf\s*{\s*display:\s*none/);
    expect(druck).toMatch(/\.bereich\s*{\s*overflow:\s*visible/);
  });

  it("laesst beim Drucken die Seitenleiste weg", () => {
    const leiste = readCss("./seitenleiste.module.css");
    const druck = leiste.slice(leiste.indexOf("@media print"));
    expect(druck).toMatch(/\.leiste\s*{\s*display:\s*none/);
  });
});
