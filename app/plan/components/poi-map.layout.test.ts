import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob der Kartenfläche die Behandlung von
// Touch-Gesten uebergeben wird (bug-005), wird deshalb direkt am CSS
// geprueft statt am gerenderten DOM (siehe app/go/go-view.layout.test.ts,
// bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/**
 * Der Wert einer Eigenschaft aus einer CSS-Regel, ohne Semikolon. Nur eine
 * Eigenschaft am Anfang einer Deklaration zaehlt, damit "width" nicht in
 * "min-width" gefunden wird; Kommentare stehen dem nicht im Weg.
 */
function dekl(rule: string, property: string) {
  return rule
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .match(new RegExp(`(?:^|[;{])\\s*${property}\\s*:\\s*([^;}]+)`))?.[1]
    .trim();
}

describe("poi-map Layout -- Touch-Verhalten der Kartenflaeche (bug-005)", () => {
  it("ueberlaesst Touch-Gesten auf der Kartenflaeche vollstaendig MapLibre", () => {
    const css = readCss("./poi-map.module.css");
    const mapRule = css.match(/\.map\s*{[^}]*}/)?.[0] ?? "";

    expect(mapRule).toMatch(/touch-action:\s*none/);
  });
});

/**
 * Die POI-Marker sassen neben ihrem Ort, und beim Zoomen fiel der Versatz
 * mal mehr, mal weniger auf (bug-036). Zwei Ursachen im CSS: der Marker
 * stellte sich zusaetzlich zur Verschiebung der Kartenbibliothek in den
 * normalen Fluss, und die Box endete nicht auf der Spitze der Tropfenform,
 * an der der Anker "bottom" haengt.
 */
describe("poi-map Layout -- Sitz der POI-Marker (bug-036)", () => {
  const css = readCss("./poi-map.module.css");
  const marker = css.match(/\.marker\s*{[^}]*}/)?.[0] ?? "";
  const drop = css.match(/\.markerDrop\s*{[^}]*}/)?.[0] ?? "";

  /**
   * Wo die Spitze liegt, wenn ein Quadrat der Kantenlaenge 1 um 45 Grad
   * gedreht wird: eine halbe Kante plus eine halbe Diagonale unter dem
   * oberen Rand, waagerecht genau in der Mitte.
   */
  const SPITZE_JE_KANTE = (1 + Math.SQRT2) / 2;

  it("ueberlaesst das Positionieren des Markers der Kartenbibliothek", () => {
    // .maplibregl-marker steht auf "position: absolute" und wird per
    // transform an seinen Ort geschoben. Ein "position: relative" hier legt
    // den Marker zusaetzlich in den normalen Fluss der Kartenflaeche --
    // beide Verschiebungen addieren sich (wie schon bug-011 bei den Griffen
    // des Suchgebiets).
    expect(dekl(marker, "position")).toBeUndefined();
  });

  it("rechnet den Rand der Tropfenform in ihre Kantenlaenge ein", () => {
    // Ohne border-box ist das Quadrat um seine beiden 2px-Raender groesser
    // als angenommen, und die Spitze sitzt neben der Mitte der Box.
    expect(dekl(drop, "box-sizing")).toBe("border-box");
    expect(dekl(drop, "width")).toBe("var(--tropfen)");
    expect(dekl(drop, "height")).toBe("var(--tropfen)");
  });

  it("legt die Spitze waagerecht in die Mitte der Marker-Box", () => {
    // Der Anker "bottom" verschiebt um die halbe Breite nach links.
    expect(dekl(marker, "width")).toBe("var(--tropfen)");
    expect(dekl(drop, "left")).toBe("0");
  });

  it("laesst die Marker-Box genau auf der Spitze der Tropfenform enden", () => {
    // Der Anker "bottom" legt die Unterkante der Box auf die Position des
    // POI -- also muss die Unterkante die Spitze sein.
    expect(dekl(marker, "height")).toBe("var(--spitze)");
    expect(dekl(drop, "top")).toBe("0");

    const spitze = dekl(marker, "--spitze") ?? "";
    expect(spitze).toContain("var(--tropfen)");
    expect(Number(spitze.match(/\*\s*([\d.]+)/)?.[1])).toBeCloseTo(
      SPITZE_JE_KANTE,
      5,
    );
  });
});

/**
 * Die automatische Bildschirmbreiten-Pruefung (req-049) deckte auf, dass
 * "Suchgebiet zeichnen" und die Status-Schalter der Karte kleiner als die
 * geforderten 44x44 px waren (bug-024).
 */
describe("poi-map Layout -- Tippziele (bug-024)", () => {
  const css = readCss("./poi-map.module.css");

  it('gibt "Suchgebiet zeichnen" mindestens 44px Hoehe', () => {
    const drawButton = css.match(/\.drawButton\s*{[^}]*}/)?.[0] ?? "";
    expect(drawButton).toMatch(/min-height:\s*44px/);
    expect(drawButton).toMatch(/box-sizing:\s*border-box/);
  });
});

/**
 * Die 44x44 px grossen Schalter des Statusfilters sahen unnatuerlich gross
 * aus (bug-025). Sie kommen jetzt aus components/tippziel-checkbox.tsx: die
 * Trefferflaeche bleibt 44x44 px, gezeichnet wird ein gewohntes Kaestchen.
 */
describe("poi-map Layout -- sichtbare Groesse des Statusfilters (bug-025)", () => {
  const css = readCss("./poi-map.module.css");

  it("baut die Status-Schalter nicht mehr selbst 44x44 px gross", () => {
    expect(css).not.toMatch(/\.statusFilterSwitch\s*{/);
  });

  it("nimmt dem Filter die Breite zurueck, die die grossen Schalter brauchten", () => {
    const panel = css.match(/\.statusFilterPanel\s*{[^}]*}/)?.[0] ?? "";
    const breite = Number(panel.match(/width:\s*(\d+)px/)?.[1]);
    expect(breite).toBeLessThanOrEqual(242);
  });
});

/**
 * Die verkleinerten Schalter aus bug-025 brachten ihre 44x44 px grosse
 * Trefferflaeche weiterhin ins Layout ein -- die Zeilen des Status-Feldes
 * standen dadurch 52 px auseinander (bug-029). Sie ueberlagert die Zeile
 * jetzt, statt ihre Hoehe zu bestimmen.
 */
describe("poi-map Layout -- Zeilenabstand im Status-Feld (bug-029)", () => {
  const css = readCss("./poi-map.module.css");
  const checkboxCss = readCss(
    "../../../components/tippziel-checkbox.module.css",
  );

  const TREFFERFLAECHE_PX = 44;

  /** Die Zeile ist so hoch wie das Groesste darin -- das Kaestchen. */
  const zeilenhoehe = Number(
    checkboxCss
      .match(/\.wrapUeberlagernd\s*{[^}]*}/)?.[0]
      ?.match(/height:\s*(\d+(?:\.\d+)?)px/)?.[1],
  );
  const abstand = Number(
    css
      .match(/\.statusFilterPanel\s*{[^}]*}/)?.[0]
      ?.match(/gap:\s*(\d+)px/)?.[1],
  );
  const vonMitteZuMitte = zeilenhoehe + abstand;

  it("gibt der Zeile keine eigene Hoehe -- sie kommt aus dem Sichtbaren", () => {
    const row = css.match(/\.statusFilterRow\s*{[^}]*}/)?.[0] ?? "";
    expect(row).not.toMatch(/height:\s*\d/);
  });

  it("haelt die Zeilen enger beieinander als die Trefferflaeche hoch ist", () => {
    expect(zeilenhoehe).toBeLessThan(TREFFERFLAECHE_PX);
    expect(vonMitteZuMitte).toBeLessThan(TREFFERFLAECHE_PX);
  });

  it("laesst die Trefferflaeche der Nachbarzeile nicht ueber das eigene Kaestchen reichen", () => {
    // Sonst schaltet ein Tipp auf die untere Haelfte eines Kaestchens den
    // Status darunter: die Trefferflaeche der Nachbarzeile ragt
    // TREFFERFLAECHE_PX / 2 ueber deren Mitte hinaus.
    const kaestchenHalb = zeilenhoehe / 2;
    expect(vonMitteZuMitte - TREFFERFLAECHE_PX / 2).toBeGreaterThanOrEqual(
      kaestchenHalb,
    );
  });
});

/**
 * Die Knoepfe des Zeichen-Bedienfeldes standen mit vollem Text da und nahmen
 * der Karte ueber 200px Breite weg (bug-042). Sie tragen jetzt ein Symbol:
 * Trefferflaeche 44x44 px, gezeichnet in der gewohnten Hoehe von 30px -- wie
 * die Aktionen der Filterzeile (bug-040).
 */
describe("poi-map Layout -- Kartenknoepfe als Symbole (bug-042)", () => {
  const css = readCss("./poi-map.module.css");

  /** Die gewohnte sichtbare Hoehe der Bedienelemente des Planers. */
  const GEWOHNTE_HOEHE = 30;

  const drawButton = css.match(/\.drawButton\s*{[^}]*}/)?.[0] ?? "";
  const drawPanel = css.match(/\.drawPanel\s*{[^}]*}/)?.[0] ?? "";

  it("haelt die Trefferflaeche der Symbole bei 44x44 px", () => {
    // stack.md, Bildschirmbreiten, Regel 4.
    expect(drawButton).toMatch(/min-height:\s*44px/);
    expect(drawButton).toMatch(/min-width:\s*44px/);
    expect(drawButton).toMatch(/box-sizing:\s*border-box/);
  });

  it("zeichnet sie in der gewohnten Hoehe der uebrigen Elemente", () => {
    // Die aeusseren Pixel sind ein durchsichtiger Rand, der allein die
    // Trefferflaeche traegt; der sichtbare Rand wird nach innen gezeichnet.
    const rand = Number(
      drawButton.match(/border:\s*(\d+(?:\.\d+)?)px solid transparent/)?.[1],
    );
    expect(44 - 2 * rand).toBe(GEWOHNTE_HOEHE);
    expect(drawButton).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  });

  it("stellt die Symbole nebeneinander statt untereinander", () => {
    const drawActions = css.match(/\.drawActions\s*{[^}]*}/)?.[0] ?? "";
    expect(drawActions).toMatch(/display:\s*flex/);
    expect(dekl(drawActions, "flex-direction")).toBeUndefined();
  });

  it("nimmt dem Bedienfeld die Breite, die der Text brauchte", () => {
    // Vorher 220px fuer "Suchgebiet zeichnen"; jetzt ist der Kasten so
    // breit wie das, was in ihm steht.
    expect(dekl(drawPanel, "width")).toBeUndefined();
  });
});

/**
 * Die Legende links unten auf der Karte ist entfallen (bug-043) -- ihre
 * Statusfarben zeigt der Statusfilter daneben ohnehin. Mit ihr geht auch ihr
 * Platz auf der Karte; die Regeln bleiben sonst zurueck und verdecken nichts
 * mehr.
 */
describe("poi-map Layout -- Legende entfernt (bug-043)", () => {
  const css = readCss("./poi-map.module.css");

  it("laesst keine Regeln der Legende im CSS zurueck", () => {
    expect(css).not.toMatch(/\.legend\s*{/);
    expect(css).not.toMatch(/\.legendRow\s*{/);
    expect(css).not.toMatch(/\.legendDot\s*{/);
  });
});
