import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- geprueft wird deshalb direkt am CSS statt am
// gerenderten DOM (siehe app/plan/components/poi-list.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * Der Bereich "Bewertungen" (req-063) traegt neun Spalten -- POI, Status, die
 * fuenf Stufen, die offenen Stimmen und die Zustimmung. Der Planer ist fuer
 * breite Bildschirme gebaut (ab 1180 px, siehe lib/plan/viewport.ts), aber
 * auch dort darf nichts ueber den Rand stehen (delivery/stack.md,
 * Bildschirmbreiten).
 */
describe("bewertungen-view Layout (req-063)", () => {
  const css = readCss("./bewertungen-view.module.css");

  it("teilt die Tabelle fest auf, statt sie vom Inhalt sprengen zu lassen", () => {
    expect(rule(css, "table")).toMatch(/table-layout:\s*fixed/);
    expect(rule(css, "table")).toMatch(/width:\s*100%/);
  });

  it("haelt den Namen und die Zahlen in ihrer Spalte", () => {
    expect(rule(css, "name")).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule(css, "nameButton")).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule(css, "namenWert")).toMatch(/overflow-wrap:\s*anywhere/);
  });

  /** Regel 4: Was mit dem Finger bedient wird, misst mindestens 44x44 px. */
  it("gibt jedem Tippziel mindestens 44 px Höhe", () => {
    expect(rule(css, "nameButton")).toMatch(/min-height:\s*44px/);
    expect(rule(css, "statusSelect")).toMatch(/min-height:\s*44px/);
    expect(rule(css, "primaryButton")).toMatch(/min-height:\s*44px/);
  });

  it("laesst das Statusfeld in seiner Spalte schrumpfen", () => {
    expect(rule(css, "statusSelect")).toMatch(/min-width:\s*0/);
    expect(rule(css, "statusSelect")).toMatch(/max-width:\s*100%/);
    expect(rule(css, "statusSelect")).toMatch(/box-sizing:\s*border-box/);
  });
});
