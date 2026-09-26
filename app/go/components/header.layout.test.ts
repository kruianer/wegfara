import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Die Groesse des Tippziels wird deshalb direkt am CSS
// geprueft (siehe app/go/go-view.layout.test.ts, bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function regel(css: string, klasse: string) {
  return css.match(new RegExp(`\\.${klasse}\\s*{[^}]*}`))?.[0] ?? "";
}

function zahl(regelText: string, eigenschaft: string): number | null {
  const wert = regelText.match(new RegExp(`${eigenschaft}:\\s*([0-9.]+)`))?.[1];
  return wert === undefined ? null : Number(wert);
}

describe("Kopfbereich des Begleiters -- Wechsel in den Planer (req-055)", () => {
  it("gibt dem Wechsel ein Tippziel von mindestens 44 x 44 px", () => {
    const wechsel = regel(readCss("./header.module.css"), "wechsel");

    // Mit dem Finger bedient (siehe stack.md, Bildschirmbreiten). Seit
    // bug-035 traegt er eine Beschriftung und ist damit breiter als hoch --
    // 44px sind das Mindestmass, nicht das feste Mass.
    expect(wechsel).toMatch(/min-width:\s*44px/);
    expect(wechsel).toMatch(/min-height:\s*44px/);
  });

  it("laesst ihn nicht schrumpfen, wenn der Reisetitel lang ist", () => {
    const wechsel = regel(readCss("./header.module.css"), "wechsel");

    expect(wechsel).toMatch(/flex:\s*none/);
  });

  // bug-035: allein mit Symbol ging er zwischen den uebrigen Symbolen der
  // Kopfzeile unter. Seine Beschriftung darf deshalb nicht umbrechen.
  it("laesst die Beschriftung des Wechsels nicht umbrechen", () => {
    const text = regel(readCss("./header.module.css"), "wechselText");

    expect(text).toMatch(/white-space:\s*nowrap/);
  });
});

/**
 * bug-056: derselbe Knopf war danach zu auffaellig -- Rahmen, eigene Flaeche
 * und 14px fette Schrift machten ihn zum lautesten Element der Kopfzeile,
 * obwohl er dort der seltenste Weg ist. Gesucht war das Mass zwischen
 * bug-035 und diesem Zustand: leiser als die Bedienelemente daneben, aber
 * ohne die Auffindbarkeit aus bug-035 aufzugeben.
 */
describe("Kopfbereich des Begleiters -- der Wechsel tritt zurueck (bug-056)", () => {
  it("gibt dem Wechsel keinen Rahmen und keine eigene Flaeche", () => {
    const wechsel = regel(readCss("./header.module.css"), "wechsel");

    expect(wechsel).toMatch(/border:\s*none/);
    expect(wechsel).not.toMatch(/border:\s*\d/);
    expect(wechsel).toMatch(/background:\s*none/);
  });

  it("haelt seine Beschriftung leichter und kleiner als zuvor", () => {
    const text = regel(readCss("./header.module.css"), "wechselText");

    // Zuvor 14px bei 600 -- dasselbe Gewicht wie die Bedienelemente der
    // Bereichsleiste, mit denen man wirklich arbeitet.
    expect(zahl(text, "font-size")).toBeLessThan(14);
    expect(zahl(text, "font-weight")).toBeLessThan(600);
  });

  it("nimmt ihm Gewicht, ohne ihn verschwinden zu lassen", () => {
    const wechsel = readCss("./header.module.css");
    const deckkraft = zahl(regel(wechsel, "wechsel"), "opacity");

    // Dieselbe Zurueckhaltung wie bei "Mein Bereich" und "Abmelden"
    // (components/abmelden-button.module.css) -- leiser, aber lesbar; beim
    // Zeigen kommt er ganz heraus.
    expect(deckkraft).not.toBeNull();
    expect(deckkraft!).toBeLessThan(1);
    expect(deckkraft!).toBeGreaterThanOrEqual(0.6);
    expect(wechsel).toMatch(/\.wechsel:hover\s*{[^}]*opacity:\s*1/);
  });
});
