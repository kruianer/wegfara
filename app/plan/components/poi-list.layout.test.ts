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
    expect(scroll).toMatch(/scrollbar-color:/);
    expect(css).toMatch(/\.scroll::-webkit-scrollbar\s*{[^}]*width:\s*10px/);
  });
});

/**
 * "Ausgewählte löschen" (req-057) und die Bewertungsrunde (req-054) standen
 * bis bug-040 mit ihrem Text in einer eigenen Leiste unter dem Filter. Sie
 * stehen jetzt als Symbol in der Filterzeile selbst -- die Leiste und alle
 * ihre Regeln sind damit fort.
 */
describe("poi-list Layout -- Aktionen in der Filterzeile (bug-040)", () => {
  const css = readCss("./poi-list.module.css");

  it("traegt keine Auswahlleiste mehr", () => {
    expect(css).not.toMatch(/\.banner\s*{/);
    expect(css).not.toMatch(/\.bannerLabel\s*{/);
    expect(css).not.toMatch(/\.bannerActions\s*{/);
    expect(css).not.toMatch(/\.bannerButton\s*{/);
    expect(css).not.toMatch(/\.bannerDangerButton\s*{/);
    expect(css).not.toMatch(/\.bannerNote\s*{/);
  });

  it("stellt die Aktionen ans rechte Ende der Filterzeile", () => {
    const aktionen = rule(css, "filterActions");
    expect(aktionen).toMatch(/display:\s*flex/);
    expect(aktionen).toMatch(/margin-left:\s*auto/);
    // Bei schmaler Spalte rutschen sie umeinander, statt aus der Zeile zu
    // ragen (siehe delivery/stack.md, Bildschirmbreiten, Regel 1).
    expect(aktionen).toMatch(/flex-wrap:\s*wrap/);
  });

  it("haelt die Trefferflaeche der Symbole bei 44x44 px", () => {
    // stack.md, Bildschirmbreiten, Regel 4 -- wie beim Loeschen-Symbol der
    // Zeile (req-060).
    const aktion = rule(css, "filterAction");
    expect(aktion).toMatch(/min-height:\s*44px/);
    expect(aktion).toMatch(/min-width:\s*44px/);
    expect(aktion).toMatch(/box-sizing:\s*border-box/);
  });

  it("faerbt das Loeschen-Symbol als Warnung", () => {
    expect(rule(css, "filterActionDanger")).toMatch(/color:\s*var\(--neg\)/);
  });
});

/**
 * Die automatische Bildschirmbreiten-Pruefung (req-049) deckte auf, dass ein
 * Grossteil der Bedienelemente der Liste kleiner als die geforderten
 * 44x44 px war (bug-024) -- und dass der letzte Typ-Filter-Chip bei 1280px
 * an seiner Mittelposition unter der Kartenansicht lag, weil die
 * ueberlaufende Filterleiste ihn statt umzubrechen wegscrollte.
 */
describe("poi-list Layout -- Tippziele und Filterleiste (bug-024)", () => {
  const css = readCss("./poi-list.module.css");

  // Seit req-060 filtern Auswahllisten statt einer Leiste aus Chips; die
  // Zeile darf dabei so wenig wegscrollen wie die Leiste zuvor.
  it("bricht die Filterzeile um, statt sie wegzuscrollen", () => {
    const filterRow = rule(css, "filterRow");
    expect(filterRow).toMatch(/flex-wrap:\s*wrap/);
    expect(filterRow).not.toMatch(/overflow-x/);
  });

  it("gibt jeder Auswahlliste des Filters mindestens 44px Trefferflaeche", () => {
    // Gezeichnet wird darin weniger -- siehe bug-039 weiter unten.
    const filterSelect = rule(css, "filterSelect");
    expect(filterSelect).toMatch(/min-height:\s*44px/);
    expect(filterSelect).toMatch(/box-sizing:\s*border-box/);
  });

  // "POI anlegen" steht seit req-060 in der Anlegezeile über der Liste --
  // seine 44px prueft poi-anlegezeile.layout.test.ts.

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
 * Trefferflaeche ist jetzt groesser als das Sichtbare: der Chip traegt einen
 * unsichtbaren Rand, die Ankreuzboxen kommen aus TippzielCheckbox.
 */
describe("poi-list Layout -- sichtbare Groesse der Bedienelemente (bug-025)", () => {
  const css = readCss("./poi-list.module.css");

  // Die Filter-Chips selbst gibt es seit req-060 nicht mehr -- an ihrer
  // Stelle stehen Auswahllisten, die in gewohnter Hoehe gezeichnet werden.
  it("traegt keine Filter-Chips mehr", () => {
    expect(css).not.toMatch(/\.chip\s*{/);
    expect(css).not.toMatch(/\.chipActive\s*{/);
  });

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
 * Dieselbe Ursache wie bug-025 und bug-028, an der Filterzeile (bug-039):
 * die 44px aus bug-024 machten die Auswahllisten sichtbar zu hoch. Sie
 * werden jetzt in der gewohnten Hoehe gezeichnet -- alle Bedienelemente der
 * Anlegezeile und der Filterzeile wirken damit als eine Reihe (die
 * Anlegezeile prueft poi-anlegezeile.layout.test.ts).
 */
describe("poi-list Layout -- sichtbare Groesse der Filterzeile (bug-039)", () => {
  const css = readCss("./poi-list.module.css");

  // Die gewohnte Hoehe eines Bedienelements: zweimal 8px Innenabstand um
  // eine Zeile 11.5px-Text (rund 14px). Sie ist das Mass, an dem sich
  // Anlegezeile und Filterzeile ausrichten.
  const GEWOHNTE_HOEHE = 30;

  /** Der unsichtbare Rand, der allein die Trefferflaeche traegt. */
  function rand(selector: string): number {
    return Number(
      rule(css, selector).match(
        /border:\s*(\d+(?:\.\d+)?)px solid transparent/,
      )?.[1],
    );
  }

  it("zeichnet die Aktions-Symbole der Zeile in dieser Hoehe (bug-040)", () => {
    // Die Symbole sind Tippziele von 44x44 px, duerfen aber nicht groesser
    // aussehen als die Auswahllisten daneben.
    const aktion = rule(css, "filterAction");
    expect(44 - 2 * rand("filterAction")).toBe(GEWOHNTE_HOEHE);
    expect(aktion).toMatch(/padding-box/);
    expect(aktion).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(aktion).not.toMatch(/border:\s*1px solid var/);
  });

  it("zeichnet die Auswahllisten des Filters in dieser Hoehe", () => {
    const select = rule(css, "filterSelect");
    expect(44 - 2 * rand("filterSelect")).toBe(GEWOHNTE_HOEHE);
    // Ohne padding-box liefe der Hintergrund unter den unsichtbaren Rand und
    // die Auswahlliste saehe wieder 44px hoch aus.
    expect(select).toMatch(/padding-box/);
    // Der sichtbare 1px-Rand wird nach innen gezeichnet, weil der echte Rand
    // die Trefferflaeche traegt.
    expect(select).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(select).not.toMatch(/border:\s*1px solid var/);
  });

  it("haelt die Trefferflaeche bei 44px (bug-024)", () => {
    const select = rule(css, "filterSelect");
    expect(select).toMatch(/min-height:\s*44px/);
    expect(select).toMatch(/box-sizing:\s*border-box/);
  });

  it("faerbt die ueberfahrene Auswahlliste nur in ihrem sichtbaren Teil", () => {
    const hover = rule(css, "filterSelect:hover");
    expect(hover).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(hover).not.toMatch(/border-color:/);
  });

  it("traegt den unsichtbaren Rand nur oben und unten", () => {
    // Waagerecht ist er nicht noetig -- die Beschriftung macht jede
    // Auswahlliste ohnehin breiter als 44px -- und er zoege die drei
    // auseinander.
    const select = rule(css, "filterSelect");
    expect(select).toMatch(/border-left-width:\s*0/);
    expect(select).toMatch(/border-right-width:\s*0/);
  });

  it("addiert die Abstaende der Filterzeile nicht auf ihren Rand", () => {
    const filterRow = rule(css, "filterRow");
    // Waagerecht bleibt der gewohnte Abstand, senkrecht kommt er beim
    // Umbruch aus dem unsichtbaren Rand der Auswahllisten selbst.
    expect(filterRow).toMatch(/gap:\s*0 12px/);
    // Unten zehrt der Rand 7px der gewohnten 10px auf.
    expect(filterRow).toMatch(
      new RegExp(`padding:\\s*0 22px ${10 - rand("filterSelect")}px`),
    );
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
 * Das gemeinsame Setzen eines Status (req-069) steht in derselben Zeile wie
 * das gemeinsame Entfernen. Es muss auf 375 px, 768 px und 1280 px bedienbar
 * sein (stack.md, Bildschirmbreiten): unter 768 px steht statt des Planers
 * der Hinweis auf einen breiteren Bildschirm (die sichtbare Ausnahme, die
 * stack.md zulaesst, siehe app/plan/plan-view.tsx) -- darueber gelten die
 * vier Regeln, und der Weg dorthin ist derselbe wie bei den Auswahllisten
 * des Filters.
 */
describe("poi-list Layout -- Status für mehrere POIs (req-069)", () => {
  const css = readCss("./poi-list.module.css");

  it("traegt dieselbe Trefferflaeche wie die Auswahllisten des Filters", () => {
    // Gezeichnet wird er ueber .filterSelect (siehe poi-list.tsx); daher
    // kommen 44px Hoehe (Regel 4) und die gewohnte sichtbare Hoehe
    // (bug-024, bug-039).
    const select = rule(css, "filterSelect");
    expect(select).toMatch(/min-height:\s*44px/);
    expect(select).toMatch(/box-sizing:\s*border-box/);
  });

  it("gibt bei schmaler Spalte nach, statt aus der Zeile zu ragen", () => {
    // Regel 1: nichts steht ueber den Rand. Ein eigenes "flex: none" wuerde
    // das Nachgeben verhindern -- die Zeile darf umbrechen und die
    // Auswahlliste schmaler werden.
    expect(rule(css, "bulkStatus")).not.toMatch(/flex:/);
    expect(rule(css, "filterSelect")).toMatch(/min-width:\s*0/);
    expect(rule(css, "filterActions")).toMatch(/flex-wrap:\s*wrap/);
    expect(rule(css, "filterRow")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("zeigt ohne angekreuzte POIs, dass es unwirksam ist", () => {
    // Wie das Loeschen-Symbol daneben (.filterAction:disabled) -- Regel 3
    // verlangt Erreichbarkeit, nicht Wirksamkeit.
    const aus = rule(css, "bulkStatus:disabled");
    expect(aus).toMatch(/opacity:\s*0\.5/);
    expect(aus).toMatch(/cursor:\s*default/);
    // Ueberfahren faerbt ihn dann nicht wie einen bedienbaren.
    expect(rule(css, "bulkStatus:disabled:hover")).toMatch(
      /box-shadow:\s*inset 0 0 0 1px var\(--bd\)/,
    );
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
