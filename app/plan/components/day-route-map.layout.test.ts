import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- was allein im Stylesheet steht, wird deshalb
// direkt am CSS geprueft statt am gerenderten DOM (siehe
// app/plan/components/poi-map.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Der Wert einer Eigenschaft aus einer CSS-Regel, ohne Semikolon. */
function dekl(rule: string, property: string) {
  return rule
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .match(new RegExp(`(?:^|[;{])\\s*${property}\\s*:\\s*([^;}]+)`))?.[1]
    .trim();
}

function regel(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * Die Richtungspfeile (req-075) liegen auf denselben Linien wie die
 * nummerierten Wegpunkte. Lesbar bleiben muessen die Wegpunkte: der Pfeil
 * darf sie weder ueberdecken noch ihre Tipps schlucken.
 */
describe("day-route-map Layout -- Pfeile verdecken die Marker nicht (req-075)", () => {
  const css = readCss("./day-route-map.module.css");
  const pfeil = regel(css, "pfeil");
  const marker = regel(css, "marker");

  it("laesst Zeiger durch den Pfeil hindurch auf die Karte", () => {
    // Ein Pfeil ist nichts zum Anfassen; ein Marker darunter bliebe sonst
    // unerreichbar.
    expect(dekl(pfeil, "pointer-events")).toBe("none");
  });

  it("legt den Pfeil unter die Wegpunkte", () => {
    // Marker werden alle absolut positioniert; ohne diese Reihenfolge
    // entschiede die Einfuegereihenfolge, und die Pfeile entstehen nach den
    // Wegpunkten -- ein Pfeil laege dann auf einer Nummer.
    const pfeilEbene = Number(dekl(pfeil, "z-index"));
    const markerEbene = Number(dekl(marker, "z-index"));

    expect(pfeilEbene).toBeLessThan(markerEbene);
  });

  it("haelt den Pfeil kleiner als den Wegpunkt", () => {
    const groesse = (rule: string, property: string) =>
      Number(dekl(rule, property)?.match(/([\d.]+)px/)?.[1]);

    expect(groesse(pfeil, "width")).toBeLessThan(groesse(marker, "width"));
    expect(groesse(pfeil, "height")).toBeLessThan(groesse(marker, "height"));
  });
});
