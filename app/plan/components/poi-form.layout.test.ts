import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Knoepfe des Formulars im sichtbaren
// Bereich bleiben (bug-016), wird deshalb direkt am CSS geprueft statt am
// gerenderten DOM (siehe poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("poi-form Layout -- Erreichbarkeit von Speichern (bug-016)", () => {
  const css = readCss("./poi-form.module.css");

  it("haelt die Knopfleiste am unteren Rand des sichtbaren Bereichs", () => {
    const actions = rule(css, "actions");
    expect(actions).toMatch(/position:\s*sticky/);
    expect(actions).toMatch(/bottom:\s*0/);
  });

  it("gibt der Knopfleiste einen deckenden Hintergrund", () => {
    // Ohne ihn scheinen die Felder durch, ueber denen die Leiste steht.
    const actions = rule(css, "actions");
    expect(actions).toMatch(/background:\s*var\(--card\)/);
  });

  it("laesst die Ortsvorschlaege ueber der Knopfleiste liegen", () => {
    const actionsZ = Number(
      rule(css, "actions").match(/z-index:\s*(\d+)/)?.[1] ?? 0,
    );
    const suggestionsZ = Number(
      rule(css, "suggestions").match(/z-index:\s*(\d+)/)?.[1] ?? 0,
    );
    expect(suggestionsZ).toBeGreaterThan(actionsZ);
  });
});

/**
 * Bilder verwalten heisst seit req-072 drei Wege statt zwei: „Bild
 * hinzufügen“, „Fotografieren“ und „Bild erzeugen“. Alle drei muessen bei
 * 375, 768 und 1280 px erreichbar bleiben (stack.md, Bildschirmbreiten).
 *
 * Der Planer selbst verweist unter PLANNER_MIN_WIDTH_PX auf einen breiteren
 * Bildschirm (lib/plan/viewport.ts) -- das ist die sichtbare Ausnahme, die
 * stack.md erlaubt. Wo das Formular steht, gelten die vier Regeln aber
 * unveraendert, und bei 375 px passen drei Wege nicht mehr nebeneinander.
 */
describe("poi-form Layout -- die drei Wege zu einem Bild (req-072)", () => {
  const css = readCss("./poi-form.module.css");

  it("laesst die drei Wege umbrechen, statt sie ueber den Rand zu schieben", () => {
    const leiste = rule(css, "photoAdd");
    expect(leiste).toMatch(/display:\s*flex/);
    expect(leiste).toMatch(/flex-wrap:\s*wrap/);
  });

  it("gibt allen dreien ein Tippziel von 44 px", () => {
    // Regel 4: Was mit dem Finger bedient wird, muss sich treffen lassen.
    // Die drei teilen sich eine Klasse -- „Bild erzeugen“ bekommt damit
    // dasselbe Ziel wie die beiden Beschriftungen daneben.
    const knopf = rule(css, "uploadButton");
    expect(knopf).toMatch(/min-height:\s*44px/);
    expect(knopf).toMatch(/box-sizing:\s*border-box/);
  });

  it("laesst „Bild erzeugen“ in derselben Schrift stehen wie die Nachbarn", () => {
    // Ein <button> erbt die Schrift nicht von selbst; ohne diese Regel
    // stuende er in der Schrift des Browsers und in anderer Groesse.
    expect(rule(css, "kiBildButton")).toMatch(/font-family:\s*inherit/);
  });

  it("haelt das Zeichen des KI-Bildes im Bild statt am Rand der Seite", () => {
    // Ohne Bezugspunkt setzte sich das absolut gesetzte Zeichen an die
    // naechste gesetzte Flaeche darueber -- bei 375 px liefe es damit aus
    // dem Formular heraus (Regel 1).
    expect(rule(css, "photoFrame")).toMatch(/position:\s*relative/);
  });
});
