import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";

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

/**
 * Ein Wegpunkt ohne POI-Nummer (bug-055) wird als Punkt gezeichnet: er traegt
 * keine Zahl, bleibt aber ein Wegpunkt -- sichtbar und nicht unter einem Pfeil
 * verschwindend.
 */
describe("day-route-map Layout -- Wegpunkt ohne Nummer (bug-055)", () => {
  const css = readCss("./day-route-map.module.css");
  const pfeil = regel(css, "pfeil");
  const marker = regel(css, "marker");
  const ohneNummer = regel(css, "markerOhneNummer");

  const px = (rule: string, property: string) =>
    Number(dekl(rule, property)?.match(/([\d.]+)px/)?.[1]);

  it("zeichnet ihn kleiner als einen nummerierten Wegpunkt", () => {
    // Er tritt nicht an die Stelle einer Zahl -- er nimmt weniger Platz ein.
    expect(px(ohneNummer, "width")).toBeLessThan(px(marker, "width"));
    expect(px(ohneNummer, "height")).toBeLessThan(px(marker, "height"));
  });

  it("laesst ihn nicht kleiner werden als einen Richtungspfeil", () => {
    expect(px(ohneNummer, "width")).toBeGreaterThanOrEqual(px(pfeil, "width"));
    expect(px(ohneNummer, "height")).toBeGreaterThanOrEqual(
      px(pfeil, "height"),
    );
  });

  it("gibt ihm eine gefuellte Flaeche, damit er ohne Zahl sichtbar bleibt", () => {
    expect(dekl(ohneNummer, "background")).toBe("var(--acc)");
  });

  it("laesst keine Media Query an ihn", () => {
    // Bei jeder Breite dieselbe Groesse, wie bei den uebrigen Wegpunkten.
    for (const block of css.match(/@media[^{]*{[\s\S]*?\n}/g) ?? []) {
      expect(block).not.toMatch(/\.markerOhneNummer\b/);
    }
  });
});

/**
 * Der Schalter fuer die Pfeile (req-075) muss bei 375 px, 768 px und 1280 px
 * erreichbar sein (stack.md, Bildschirmbreiten).
 *
 * Unter 1180 px (lib/plan/viewport.ts) zeigt der Planer statt seiner
 * Oberflaeche den Hinweis auf einen breiteren Bildschirm -- die sichtbare
 * Ausnahme, die stack.md zulaesst. Auf 375 px und 768 px gibt es also gar
 * keine Tageskarte und damit auch keinen Schalter; geprueft wird hier, was auf
 * 1280 px gilt (siehe app/plan/plan-view.test.tsx fuer alle drei Breiten).
 */
describe("day-route-map Layout -- Pfeil-Schalter auf 375, 768 und 1280 px (req-075)", () => {
  const css = readCss("./day-route-map.module.css");
  const schalter = regel(css, "pfeilSchalter");
  const overlay = regel(css, "overlay");

  it("zeigt den Planer erst ab einer Breite, auf der die Karte Platz hat", () => {
    // 375 px und 768 px liegen darunter: dort steht der Hinweis, keine Karte.
    expect(PLANNER_MIN_WIDTH_PX).toBeGreaterThan(768);
    expect(PLANNER_MIN_WIDTH_PX).toBeLessThanOrEqual(1280);
  });

  it("haelt die Trefferflaeche bei 44x44 px", () => {
    // stack.md, Bildschirmbreiten, Regel 4.
    expect(schalter).toMatch(/min-width:\s*44px/);
    expect(schalter).toMatch(/min-height:\s*44px/);
    expect(dekl(schalter, "box-sizing")).toBe("border-box");
  });

  it("setzt ihn dem Tages-Schild gegenueber, nicht darueber", () => {
    // Regel 2: nichts ueberlappt. Das Schild haengt links, der Schalter
    // rechts -- an derselben Oberkante, aber nie auf derselben Stelle.
    expect(dekl(overlay, "left")).toBeDefined();
    expect(dekl(schalter, "right")).toBeDefined();
    expect(dekl(schalter, "left")).toBeUndefined();
  });

  it("laesst ihn nicht ueber den Rand der Karte stehen", () => {
    // Regel 1: er haengt absolut in der Spalte, mit Abstand zu ihrem Rand.
    expect(dekl(schalter, "position")).toBe("absolute");
    expect(
      Number(dekl(schalter, "right")?.match(/(\d+)px/)?.[1]),
    ).toBeGreaterThan(0);
    expect(
      Number(dekl(schalter, "top")?.match(/(\d+)px/)?.[1]),
    ).toBeGreaterThan(0);
  });

  it("legt ihn ueber die Kartenflaeche, damit nichts ihn verdeckt", () => {
    // Regel 3: alles Bedienbare ist erreichbar.
    expect(Number(dekl(schalter, "z-index"))).toBeGreaterThan(0);
  });

  it("laesst keine Media Query an Schalter und Pfeil", () => {
    // Bei jeder Breite dieselbe Groesse, derselbe Platz.
    for (const block of css.match(/@media[^{]*{[\s\S]*?\n}/g) ?? []) {
      expect(block).not.toMatch(/\.pfeilSchalter\b/);
      expect(block).not.toMatch(/\.pfeil\b/);
    }
  });
});
