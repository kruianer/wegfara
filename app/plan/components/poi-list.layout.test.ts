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
    expect(rule(css, "row")).not.toMatch(/display:\s*flex/);
    expect(rule(css, "rowTop")).toMatch(/display:\s*flex/);
  });

  it("gibt dem Formular der Zeile die ganze Breite ihrer Box", () => {
    // Seit req-060 steht jede Zeile in einer eigenen Box; das Formular
    // nutzt deren Innenbreite, also seitlich denselben Abstand oben wie
    // unten. Ein einseitiger Innenabstand schoebe es aus der Box heraus.
    expect(rule(css, "rows")).toMatch(/padding:\s*0 22px 22px/);
    expect(rule(css, "row")).toMatch(/padding:\s*12px 13px/);
    expect(rule(css, "row")).not.toMatch(/padding-(left|right)/);
    expect(rule(readCss("./poi-form.module.css"), "formStandalone")).toMatch(
      /margin:\s*0 22px 13px/,
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
    expect(row).toMatch(/border-radius:\s*16px/);
    expect(row).toMatch(/background:\s*var\(--card-alt\)/);
    expect(row).toMatch(/border:\s*1px solid/);
    // Der Trennstrich der alten Zeilen ist damit ueberfluessig.
    expect(row).not.toMatch(/border-bottom:/);
  });

  it("setzt die Boxen mit Abstand voneinander ab", () => {
    const rows = rule(css, "rows");
    expect(rows).toMatch(/display:\s*flex/);
    expect(rows).toMatch(/flex-direction:\s*column/);
    expect(rows).toMatch(/gap:\s*10px/);
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
 * Die Auswahlleiste traegt seit req-057 zwei Schaltflaechen nebeneinander:
 * "Ausgewählte löschen" und, beim Reiseleiter, die Bewertungsrunde. Bei
 * schmaler Spalte muessen sie umbrechen, statt aus der Leiste zu ragen
 * (siehe delivery/stack.md, Bildschirmbreiten, Regel 1).
 */
describe("poi-list Layout -- Auswahlleiste (req-057)", () => {
  const css = readCss("./poi-list.module.css");

  it("laesst die Schaltflaechen der Leiste umbrechen", () => {
    const aktionen = rule(css, "bannerActions");
    expect(aktionen).toMatch(/display:\s*flex/);
    expect(aktionen).toMatch(/flex-wrap:\s*wrap/);
  });

  it("bricht die Beschriftung der Schaltflaechen nicht mitten im Wort", () => {
    expect(rule(css, "bannerDangerButton")).toMatch(/white-space:\s*nowrap/);
    expect(rule(css, "bannerButton")).toMatch(/white-space:\s*nowrap/);
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

  it("gibt jeder Auswahlliste des Filters mindestens 44px Hoehe", () => {
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

  it("gibt den Verweisen Google/Website/Maps mindestens 44px Hoehe", () => {
    const linkPill = rule(css, "linkPill");
    expect(linkPill).toMatch(/min-height:\s*44px/);
    expect(linkPill).toMatch(/box-sizing:\s*border-box/);
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
 * 44px aus bug-024 machten Google/Website/Maps sichtbar zu hoch. Die
 * Trefferflaeche bleibt 44x44 px, gezeichnet wird darin nur der gewohnte
 * flache Verweis.
 */
describe("poi-list Layout -- sichtbare Groesse der Verweise (bug-028)", () => {
  const css = readCss("./poi-list.module.css");

  function randDesVerweises(): number {
    const rand = rule(css, "linkPill").match(
      /border:\s*(\d+(?:\.\d+)?)px solid transparent/,
    )?.[1];
    return Number(rand);
  }

  it("zeichnet Google/Website/Maps flacher als ihre Trefferflaeche", () => {
    const pill = rule(css, "linkPill");
    // Der unsichtbare Rand traegt die 44px, sichtbar bleibt die gewohnte
    // Hoehe (44px minus zweimal Rand) wie vor bug-024.
    const rand = randDesVerweises();
    expect(rand).toBeGreaterThanOrEqual(7);
    expect(44 - 2 * rand).toBeLessThanOrEqual(28);
    // Ohne padding-box liefe der Hintergrund unter den unsichtbaren Rand und
    // der Verweis saehe wieder 44px hoch aus.
    expect(pill).toMatch(/padding-box/);
    // Der sichtbare 1px-Rand wird nach innen gezeichnet, weil der echte Rand
    // die Trefferflaeche traegt.
    expect(pill).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  });

  it("haelt die Trefferflaeche bei 44x44 px (bug-024)", () => {
    const pill = rule(css, "linkPill");
    expect(pill).toMatch(/min-height:\s*44px/);
    expect(pill).toMatch(/min-width:\s*44px/);
    expect(pill).toMatch(/box-sizing:\s*border-box/);
  });

  it("faerbt den ueberfahrenen Verweis nur in seinem sichtbaren Teil", () => {
    expect(rule(css, "linkPill:hover")).toMatch(
      /box-shadow:\s*inset 0 0 0 1px/,
    );
  });

  it("traegt den unsichtbaren Rand nur oben und unten", () => {
    // Waagerecht ist er nicht noetig -- die Beschriftung macht jeden Verweis
    // ohnehin breiter als 44px -- und er wuerde die Verweise auseinander
    // ziehen.
    const pill = rule(css, "linkPill");
    expect(pill).toMatch(/border-left-width:\s*0/);
    expect(pill).toMatch(/border-right-width:\s*0/);
  });

  it("addiert den Abstand um die Verweise nicht auf ihren Rand", () => {
    const rand = randDesVerweises();
    const links = rule(css, "rowLinks");
    // Waagerecht bleibt der gewohnte Abstand, senkrecht kommt er beim
    // Umbruch aus dem Rand der Verweise selbst.
    expect(links).toMatch(/gap:\s*0 7px/);
    // Oben und unten zehrt der Abstand den Rand auf, damit die Zeile
    // aussieht wie zuvor.
    expect(links).toMatch(/margin-top:\s*0/);
    expect(links).toMatch(new RegExp(`margin-bottom:\\s*-${rand}px`));
  });
});

/**
 * Das Löschen-Symbol rechts in der Box (req-060) folgt derselben Loesung
 * wie Chip und Verweise: 44x44 px Trefferflaeche, sichtbar bleibt das
 * kleine runde Symbol (bug-024, bug-025, bug-028).
 */
describe("poi-list Layout -- Loeschen-Symbol der Box (req-060)", () => {
  const css = readCss("./poi-list.module.css");

  it("haelt die Trefferflaeche bei 44x44 px", () => {
    const knopf = rule(css, "rowDelete");
    expect(knopf).toMatch(/min-height:\s*44px/);
    expect(knopf).toMatch(/min-width:\s*44px/);
    expect(knopf).toMatch(/box-sizing:\s*border-box/);
  });

  it("zeichnet es kleiner als seine Trefferflaeche", () => {
    const knopf = rule(css, "rowDelete");
    const rand = Number(
      knopf.match(/border:\s*(\d+(?:\.\d+)?)px solid transparent/)?.[1],
    );
    expect(rand).toBeGreaterThanOrEqual(7);
    expect(44 - 2 * rand).toBeLessThanOrEqual(30);
    expect(knopf).toMatch(/padding-box/);
    expect(knopf).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  });
});
