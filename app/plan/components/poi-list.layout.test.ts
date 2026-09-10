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

  it("gibt dem Formular der Zeile dieselbe Breite wie dem beim Anlegen", () => {
    // Beide sitzen mit demselben seitlichen Abstand im linken Container:
    // das Formular beim Anlegen ueber .formStandalone, das der Zeile ueber
    // die Innenabstaende der Liste.
    expect(rule(css, "rows")).toMatch(/padding:\s*0 22px 22px/);
    expect(rule(css, "row")).not.toMatch(/padding-(left|right)/);
    expect(rule(readCss("./poi-form.module.css"), "formStandalone")).toMatch(
      /margin:\s*0 22px 13px/,
    );
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

  it("bricht die Filterleiste um, statt sie wegzuscrollen", () => {
    const filterBar = rule(css, "filterBar");
    expect(filterBar).toMatch(/flex-wrap:\s*wrap/);
    expect(filterBar).not.toMatch(/overflow-x/);
  });

  it("gibt jedem Typ-Filter-Chip mindestens 44px Hoehe", () => {
    const chip = rule(css, "chip");
    expect(chip).toMatch(/min-height:\s*44px/);
    expect(chip).toMatch(/box-sizing:\s*border-box/);
  });

  it('gibt "POI anlegen" mindestens 44px Hoehe', () => {
    const createButton = rule(css, "createButton");
    expect(createButton).toMatch(/min-height:\s*44px/);
    expect(createButton).toMatch(/box-sizing:\s*border-box/);
  });

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

  it("zeichnet den Chip kleiner als seine Trefferflaeche", () => {
    const chip = rule(css, "chip");
    // Der unsichtbare Rand traegt die 44px, der sichtbare Teil bleibt
    // in gewohnter Hoehe (44px minus zweimal Rand).
    const rand = Number(
      chip.match(/border:\s*(\d+(?:\.\d+)?)px solid transparent/)?.[1],
    );
    expect(rand).toBeGreaterThanOrEqual(7);
    expect(44 - 2 * rand).toBeLessThanOrEqual(30);
    // Ohne padding-box liefe der Hintergrund unter den unsichtbaren Rand und
    // der Chip saehe wieder 44px hoch aus.
    expect(chip).toMatch(/padding-box/);
    // Der sichtbare 1px-Rand wird nach innen gezeichnet, weil der echte Rand
    // die Trefferflaeche traegt.
    expect(chip).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  });

  it("faerbt den aktiven Chip nur innerhalb seines sichtbaren Teils", () => {
    const aktiv = rule(css, "chipActive");
    expect(aktiv).toMatch(/padding-box/);
    expect(aktiv).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  });

  it("baut die Ankreuzboxen nicht mehr selbst 44x44 px gross", () => {
    // Sie kommen jetzt aus components/tippziel-checkbox.tsx -- dort ist die
    // Trefferflaeche 44x44 px und das Kaestchen darin klein.
    expect(css).not.toMatch(/\.rowCheckbox\s*{/);
    expect(css).not.toMatch(/\.bannerCheckbox\s*{/);
  });
});
