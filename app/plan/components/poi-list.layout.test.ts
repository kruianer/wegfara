import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob das Formular einer Zeile die ganze Breite
// der Liste bekommt (bug-014), wird deshalb direkt am CSS geprueft statt am
// gerenderten DOM (siehe app/go/go-view.layout.test.ts, bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("poi-list Layout -- Breite des Formulars einer Zeile (bug-014)", () => {
  const css = readCss("./poi-list.module.css");

  it("teilt die Zeile selbst nicht in Spalten -- das taete .rowTop", () => {
    expect(rule(css, "row")).not.toMatch(/display:\s*(flex|grid)/);
    // Seit req-097 ein Raster aus drei Spalten statt einer Flex-Zeile.
    expect(rule(css, "rowTop")).toMatch(/display:\s*grid/);
  });

  it("gibt dem Formular der Zeile die ganze Breite ihrer Box", () => {
    // Seit req-060 steht jede Zeile in einer eigenen Box; das Formular
    // nutzt deren Innenbreite, also seitlich denselben Abstand oben wie
    // unten. Ein einseitiger Innenabstand schoebe es aus der Box heraus.
    // Seit req-097 sind die Abstaende enger (8px statt 22/13px), damit die
    // Mitte der 324 px schmalen Spalte Platz behaelt.
    expect(rule(css, "rows")).toMatch(/padding:\s*0 8px 8px/);
    expect(rule(css, "row")).toMatch(/padding:\s*8px;/);
    expect(rule(css, "row")).not.toMatch(/padding-(left|right)/);
    expect(rule(readCss("./poi-form.module.css"), "formStandalone")).toMatch(
      /margin:\s*0 8px 13px/,
    );
  });
});

/**
 * Jeder POI steht seit req-060 in einer eigenen Box mit abgerundeten Ecken,
 * deutlich von der naechsten abgesetzt.
 */
describe("poi-list Layout -- Box je POI (req-060)", () => {
  const css = readCss("./poi-list.module.css");

  it("gibt jeder Zeile abgerundete Ecken und eine eigene Flaeche", () => {
    const row = rule(css, "row");
    expect(row).toMatch(/border-radius:\s*12px/);
    expect(row).toMatch(/background:\s*var\(--card-alt\)/);
    expect(row).toMatch(/border:\s*1px solid/);
    // Der Trennstrich der alten Zeilen ist damit ueberfluessig.
    expect(row).not.toMatch(/border-bottom:/);
  });

  it("setzt die Boxen mit Abstand voneinander ab", () => {
    const rows = rule(css, "rows");
    expect(rows).toMatch(/display:\s*flex/);
    expect(rows).toMatch(/flex-direction:\s*column/);
    expect(rows).toMatch(/gap:\s*6px/);
  });

  it("hebt die angeklickte Box hervor, ohne sie zu verschieben", () => {
    const hervorgehoben = rule(css, "rowHighlighted");
    expect(hervorgehoben).toMatch(/border-color:/);
    expect(hervorgehoben).not.toMatch(/margin:/);
    expect(hervorgehoben).not.toMatch(/padding-(left|right):/);
  });
});

describe("poi-list Layout -- Erreichbarkeit der Formulare (bug-016)", () => {
  const css = readCss("./poi-list.module.css");

  it("scrollt alles unter den Leisten in einem Bereich, nicht nur die Liste", () => {
    const scroll = rule(css, "scroll");
    expect(scroll).toMatch(/overflow-y:\s*auto/);
    expect(scroll).toMatch(/flex:\s*1/);
    // Ohne min-height: 0 waechst der Bereich mit seinem Inhalt statt zu
    // scrollen -- der Ueberstand wird dann von .pane abgeschnitten.
    expect(scroll).toMatch(/min-height:\s*0/);

    // Die Liste selbst scrollt nicht mehr: sonst laege das Formular beim
    // Anlegen wieder ausserhalb des scrollenden Bereichs.
    expect(rule(css, "rows")).not.toMatch(/overflow/);
  });

  it("zeigt die Bildlaufleiste dauerhaft an", () => {
    const scroll = rule(css, "scroll");
    expect(scroll).toMatch(/scrollbar-gutter:\s*stable/);
  });

  it("faerbt die Bildlaufleiste in den Farben der App, nicht im Grau des Browsers (req-097)", () => {
    // Gezeichnet wird sie vom gemeinsamen Blatt (bug-041) -- hier stehen nur
    // seine beiden Variablen, keine eigenen Regeln fuer den Bildlauf.
    const scroll = rule(css, "scroll");
    expect(scroll).toMatch(/--bildlauf-rille:\s*var\(--card\)/);
    expect(scroll).toMatch(/--bildlauf-griff:\s*var\(--bd\)/);
    expect(scroll).not.toMatch(/scrollbar-color/);
    expect(css).not.toMatch(/::-webkit-scrollbar/);
    // Die Rille traegt den Grund, auf dem die Liste steht.
    const split = readCss("./split-view.module.css");
    expect(split).toMatch(
      /\.pane:first-child\s*{[^}]*background:\s*var\(--card\)/,
    );
  });
});

/**
 * Die automatische Bildschirmbreiten-Pruefung (req-049) deckte auf, dass ein
 * Grossteil der Bedienelemente der Liste kleiner als die geforderten
 * 44x44 px war (bug-024). Die Filterzeile von damals ist seit req-098 der
 * Kopf der Liste -- seine Tippziele prueft der Block weiter unten.
 */
describe("poi-list Layout -- Tippziele der Zeile (bug-024)", () => {
  const css = readCss("./poi-list.module.css");

  it("gibt dem Namen einer Zeile (klappt das Formular auf) mindestens 44px Hoehe", () => {
    const rowName = rule(css, "rowName");
    expect(rowName).toMatch(/min-height:\s*44px/);
    expect(rowName).toMatch(/box-sizing:\s*border-box/);
  });

  it("gibt den Wegen der Zeile mindestens 44px Hoehe", () => {
    // Seit req-097 zwei Symbole (Webseite, Karte) statt Google/Website/Maps.
    const weg = rule(css, "weg");
    expect(weg).toMatch(/height:\s*44px/);
    expect(weg).toMatch(/box-sizing:\s*border-box/);
  });

  it("gibt der Status-Auswahl mindestens 44px Hoehe", () => {
    const statusSelect = rule(css, "statusSelect");
    expect(statusSelect).toMatch(/min-height:\s*44px/);
    expect(statusSelect).toMatch(/box-sizing:\s*border-box/);
  });
});

/**
 * Die 44px aus bug-024 liessen die Bedienelemente der POI-Ansicht
 * unnatuerlich gross aussehen (bug-025). Die Regel bleibt, aber die
 * Trefferflaeche ist jetzt groesser als das Sichtbare.
 */
describe("poi-list Layout -- sichtbare Groesse der Bedienelemente (bug-025)", () => {
  const css = readCss("./poi-list.module.css");

  it("baut die Ankreuzboxen nicht mehr selbst 44x44 px gross", () => {
    // Sie kommen jetzt aus components/tippziel-checkbox.tsx -- dort ist die
    // Trefferflaeche 44x44 px und das Kaestchen darin klein.
    expect(css).not.toMatch(/\.rowCheckbox\s*{/);
    expect(css).not.toMatch(/\.bannerCheckbox\s*{/);
  });
});

/**
 * Dieselbe Ursache wie bug-025, an den Verweisen der Zeile (bug-028): die
 * 44px aus bug-024 machten die Verweise sichtbar zu hoch. Die Trefferflaeche
 * bleibt 44x44 px, gezeichnet wird darin nur der gewohnte flache Verweis.
 *
 * Seit req-097 sind es zwei Symbole von 26 px (Webseite, Karte). Die Flaeche
 * darum zeichnet nichts; gezeichnet wird allein `.wegSymbol` darin.
 */
describe("poi-list Layout -- sichtbare Groesse der Verweise (bug-028)", () => {
  const css = readCss("./poi-list.module.css");

  /** Ein Mass einer Eigenschaft in Pixeln. */
  function px(regelText: string, name: string): number {
    return Number(
      regelText.match(new RegExp(`(?:^|[\\s{;])${name}:\\s*(-?\\d+)px`))?.[1],
    );
  }

  it("zeichnet die Wege flacher als ihre Trefferflaeche", () => {
    const symbol = rule(css, "wegSymbol");
    expect(px(symbol, "width")).toBe(26);
    expect(px(symbol, "height")).toBe(26);
    expect(symbol).toMatch(/background:/);
    // Die Trefferflaeche selbst traegt keinen Hintergrund -- sonst saehe der
    // Weg wieder 44px gross aus.
    expect(rule(css, "weg")).not.toMatch(/background/);
  });

  it("haelt die Trefferflaeche bei 44x44 px (bug-024)", () => {
    const weg = rule(css, "weg");
    expect(px(weg, "width")).toBe(44);
    expect(px(weg, "height")).toBe(44);
    expect(weg).toMatch(/box-sizing:\s*border-box/);
  });

  it("faerbt den ueberfahrenen Weg nur in seinem sichtbaren Teil", () => {
    expect(css).toMatch(
      /\.weg:hover \.wegSymbol\s*{[^}]*box-shadow:\s*inset 0 0 0 1px/,
    );
  });

  it("legt zwei Trefferflaechen hoechstens 4px uebereinander (Regel 2)", () => {
    const naechster = css.match(/\.weg \+ \.weg\s*{[^}]*}/)?.[0] ?? "";
    expect(px(naechster, "margin-left")).toBeGreaterThanOrEqual(-4);
  });

  it("laesst das Symbol buendig mit den Fakten unter dem Bild abschliessen", () => {
    // Was unter dem Symbol liegt, ragt per negativem Rand in den
    // Innenabstand der Zeile -- die Zeile waechst dafuer nicht.
    const oben = px(rule(css, "weg"), "padding-top");
    const unten = 44 - oben - 26;
    expect(px(rule(css, "wege"), "margin-bottom")).toBe(-unten);
    // Mehr als Innenabstand und Rand der Box zusammen plus der Abstand zur
    // naechsten Box darf es nicht sein.
    expect(unten).toBeLessThanOrEqual(8 + 1 + 6);
  });
});

/**
 * Der Kopf der Liste (req-098) ersetzt die Filterzeile aus req-060, bug-039
 * und bug-040. Was dort galt, gilt weiter: Tippziele von 44x44 px
 * (stack.md, Regel 4), gezeichnet aber in der gewohnten Hoehe -- die
 * Schaltflaeche zeichnet nichts, gezeichnet wird eine Flaeche darin.
 */
describe("poi-list Layout -- Kopf der Liste (req-098, vormals bug-024/039/040)", () => {
  const kopf = readCss("./poi-listen-kopf.module.css");
  const liste = readCss("./poi-list.module.css");

  /** Ein Mass einer Eigenschaft in Pixeln. */
  function px(regelText: string, name: string): number {
    return Number(
      regelText.match(new RegExp(`(?:^|[\\s{;])${name}:\\s*(-?\\d+)px`))?.[1],
    );
  }

  it("traegt keine Filterzeile, keine Auswahllisten und keine Auswahlleiste mehr", () => {
    for (const klasse of [
      "filterRow",
      "filterSelect",
      "filterLabel",
      "filterActions",
      "filterAction",
      "filterNote",
      "bulkStatus",
      "banner",
      "bannerActions",
    ]) {
      expect(liste).not.toMatch(new RegExp(`\\.${klasse}\\s*{`));
    }
  });

  it("gibt jedem Griff, jeder Pille und jedem Chip 44x44 px Trefferflaeche", () => {
    for (const klasse of ["knopf", "pille", "chip"]) {
      const regel = rule(kopf, klasse);
      expect(px(regel, "min-height"), klasse).toBe(44);
      expect(px(regel, "min-width"), klasse).toBe(44);
      expect(regel, klasse).toMatch(/box-sizing:\s*border-box/);
      // Die Trefferflaeche selbst zeichnet nichts.
      expect(regel, klasse).toMatch(/background:\s*transparent/);
      expect(regel, klasse).toMatch(/border:\s*0/);
    }
  });

  it("zeichnet die Griffe 30 px hoch, wie die Anlegezeile darueber (bug-039)", () => {
    expect(px(rule(kopf, "knopfFlaeche"), "min-height")).toBe(30);
  });

  it("zeichnet die Pillen 26 px hoch -- eine Reihe mit Abstand ist ein Tippziel", () => {
    expect(px(rule(kopf, "pillenFlaeche"), "min-height")).toBe(26);
    // Senkrecht kein Abstand zwischen den Reihen: er steckt in den 44 px.
    expect(rule(kopf, "wahl")).toMatch(/gap:\s*0 4px/);
    expect(rule(kopf, "wahl")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("gibt dem Suchfeld 44 px und zeichnet davon 30", () => {
    const feld = rule(kopf, "suchfeld");
    expect(px(feld, "min-height")).toBe(44);
    expect(
      44 - 2 * Number(feld.match(/border:\s*(\d+)px solid transparent/)?.[1]),
    ).toBe(30);
    expect(feld).toMatch(/padding-box/);
    expect(feld).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  });

  it("laesst das Suchfeld nachgeben, statt die Griffe aus der Spalte zu schieben", () => {
    expect(rule(kopf, "suche")).toMatch(/flex:\s*1/);
    expect(rule(kopf, "suche")).toMatch(/min-width:\s*0/);
  });

  it("faerbt Entfernen als Warnung (req-057)", () => {
    expect(kopf).toMatch(
      /\.gefahr \.knopfFlaeche\s*{[^}]*color:\s*var\(--neg\)/,
    );
  });

  it("zeichnet „Fertig“ und „Alle zurücksetzen“ ohne Rahmen", () => {
    expect(kopf).toMatch(
      /\.leise \.knopfFlaeche,[^{]*{[^}]*border-color:\s*transparent/,
    );
  });

  it("legt die Aktionsliste unsichtbar ueber den ganzen Knopf (req-069)", () => {
    const aktion = rule(kopf, "aktionsliste");
    expect(aktion).toMatch(/opacity:\s*0/);
    expect(aktion).toMatch(/inset:\s*0/);
  });

  it("gibt dem Zuruecksetzen der Leermeldung 44 px", () => {
    const knopf = rule(liste, "leerZuruecksetzen");
    expect(px(knopf, "min-height")).toBe(44);
    expect(px(knopf, "min-width")).toBe(44);
  });
});

/**
 * Das Löschen-Symbol rechts in der Box (req-060) gibt es seit req-097 nicht
 * mehr -- gelöscht wird über das Formular und den Auswahlmodus. Mit ihm sind
 * seine Regeln fort.
 */
describe("poi-list Layout -- kein Loeschen-Symbol in der Box (req-060, req-097)", () => {
  const css = readCss("./poi-list.module.css");

  it("traegt keine Regel mehr fuer ein Loeschen-Symbol der Zeile", () => {
    expect(css).not.toMatch(/\.rowDelete\s*{/);
  });
});

/**
 * Die dreispaltige Zeile (req-097). jsdom führt kein CSS aus -- Masse, feste
 * Höhe, Abschneiden und Bewegung stehen deshalb hier am Blatt.
 */
describe("poi-list Layout -- die dreispaltige Zeile (req-097)", () => {
  const css = readCss("./poi-list.module.css");

  /** Der Block einer Media Query samt der Regeln darin. */
  function mediaBlock(bedingung: string) {
    const start = css.indexOf(`@media ${bedingung}`);
    return start < 0 ? "" : css.slice(start, css.indexOf("\n}", start));
  }

  it("zeigt das Bild 104 x 78 px", () => {
    const bild = rule(css, "bild");
    expect(bild).toMatch(/width:\s*104px/);
    expect(bild).toMatch(/height:\s*78px/);
    expect(rule(css, "rowTop")).toMatch(/104px/);
    // Das Foto fuellt das Feld, ohne verzerrt zu werden.
    expect(rule(css, "photo")).toMatch(/object-fit:\s*cover/);
  });

  it("hat eine feste Hoehe aus Bild, Fuge und Fakten -- mit und ohne Kurztext", () => {
    // 78 px Bild + 4 px Fuge + 17 px Fakten.
    expect(rule(css, "rowTop")).toMatch(/[^-]height:\s*99px/);
    expect(rule(css, "bildspalte")).toMatch(/gap:\s*4px/);
    expect(rule(css, "unterbild")).toMatch(/height:\s*17px/);
  });

  it("schneidet einen langen Kurztext ab, statt die Zeile zu strecken", () => {
    const text = rule(css, "kurztext");
    expect(text).toMatch(/-webkit-line-clamp:\s*2/);
    expect(text).toMatch(/overflow:\s*hidden/);
    expect(text).toMatch(/min-height:\s*0/);
    // Bei breiterer Spalte drei Zeilen.
    expect(css).toMatch(
      /@container poi-liste \(min-width: \d+px\)\s*{\s*\.kurztext\s*{\s*-webkit-line-clamp:\s*3/,
    );
    expect(rule(css, "scroll")).toMatch(
      /container:\s*poi-liste \/ inline-size/,
    );
    // Auch der Knopf um Titel und Kurztext waechst nicht ueber die Zeile.
    expect(rule(css, "rowName")).toMatch(/overflow:\s*hidden/);
  });

  it("kuerzt den Titel nach zwei Zeilen", () => {
    const titel = rule(css, "titel");
    expect(titel).toMatch(/-webkit-line-clamp:\s*2/);
    expect(titel).toMatch(/overflow:\s*hidden/);
  });

  it("setzt einen Trenner nur zwischen Ort und Kurztext", () => {
    expect(css).toMatch(
      /\.ort:not\(:last-child\)::after\s*{[^}]*content:\s*" · "/,
    );
  });

  it("legt Nummer und Typ durchscheinend auf das Bild", () => {
    for (const klasse of ["nummer", "typBand"]) {
      const regel = rule(css, klasse);
      expect(regel).toMatch(/position:\s*absolute/);
      expect(regel).toMatch(/backdrop-filter:\s*blur/);
      // Klicks gehen zum Foto darunter (bug-038).
      expect(regel).toMatch(/pointer-events:\s*none/);
    }
    const band = rule(css, "typBand");
    expect(band).toMatch(/bottom:\s*0/);
    expect(band).toMatch(/left:\s*0/);
    expect(band).toMatch(/right:\s*0/);
  });

  it("faerbt das Typ-Band in der Typfarbe der Zeile", () => {
    expect(rule(css, "typBand")).toMatch(/var\(--typ\)/);
    expect(rule(css, "typBand")).toMatch(/color:\s*#fff/);
  });

  it("gibt dem Weltkulturerbe einen Glow und ein leises Atmen", () => {
    expect(rule(css, "bildWelterbe")).toMatch(/box-shadow:/);
    expect(css).toMatch(
      /\.bildWelterbe \.typBand\s*{[^}]*animation:\s*welterbeAtmen 4\.5s/,
    );
    expect(css).toMatch(
      /@keyframes welterbeAtmen[\s\S]*?filter:\s*brightness\(1\.08\)/,
    );
  });

  it("haelt bei abgestellter Bewegung das Atmen an und laesst den Glow", () => {
    const ruhig = mediaBlock("(prefers-reduced-motion: reduce)");
    expect(ruhig).toMatch(/\.bildWelterbe \.typBand\s*{[^}]*animation:\s*none/);
    // Der Glow steht ausserhalb dieser Bedingung und gilt damit immer.
    expect(ruhig).not.toMatch(/box-shadow/);
    expect(css.indexOf(".bildWelterbe {")).toBeLessThan(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
  });

  it("traegt kein Farbband am linken Rand", () => {
    expect(rule(css, "row")).not.toMatch(/border-left/);
    expect(css).not.toMatch(/\.statusDot\s*{/);
  });

  it("faerbt die Statuspille in ihrer Statusfarbe", () => {
    const pille = rule(css, "statusSelect");
    expect(pille).toMatch(/color:\s*var\(--status\)/);
    expect(pille).toMatch(
      /background-color:\s*color-mix\([^;]*var\(--status\)/,
    );
    expect(pille).toMatch(
      /box-shadow:\s*inset 0 0 0 1px color-mix\([^;]*var\(--status\)/,
    );
  });

  it("gibt Status und Gegend eine fest breite Spalte", () => {
    expect(rule(css, "rowTop")).toMatch(
      /grid-template-columns:[^;]*minmax\(0, 1fr\) \d+px;/,
    );
    const gegend = rule(css, "gegend");
    expect(gegend).toMatch(/white-space:\s*nowrap/);
    expect(gegend).toMatch(/text-overflow:\s*ellipsis/);
    expect(gegend).toMatch(/overflow:\s*hidden/);
  });
});

/**
 * Das Ankreuzfeld erscheint erst im Auswahlmodus (req-097). Im Normalfall
 * hat die Zeile keine Spalte dafür; im Modus genügen 20 px, weil die ganze
 * Zeile das Tippziel ist.
 */
describe("poi-list Layout -- Auswahlmodus (req-097)", () => {
  const css = readCss("./poi-list.module.css");

  it("gibt dem Ankreuzfeld im Normalfall keine Spalte", () => {
    expect(rule(css, "rowTop")).toMatch(
      /grid-template-columns:\s*104px minmax\(0, 1fr\)/,
    );
  });

  it("gibt ihm im Auswahlmodus 20 px vor dem Bild", () => {
    expect(rule(css, "rowTopWaehlbar")).toMatch(
      /grid-template-columns:\s*20px 104px minmax\(0, 1fr\)/,
    );
  });

  it("hebt eine angekreuzte Zeile hervor, ohne sie zu verschieben", () => {
    const an = rule(css, "rowAusgewaehlt");
    expect(an).toMatch(/border-color:\s*var\(--acc\)/);
    expect(an).not.toMatch(/margin|padding/);
  });

  it("haelt die Aktionen bei 44 px Trefferflaeche", () => {
    // Seit req-098 stehen sie im Kopf der Liste; dort tragen sie .knopf --
    // von da kommen die 44x44 px.
    const kopf = readCss("./poi-listen-kopf.module.css");
    expect(rule(kopf, "knopf")).toMatch(/min-height:\s*44px/);
    expect(rule(kopf, "knopfFlaeche")).not.toMatch(/min-height:\s*44px/);
  });
});
