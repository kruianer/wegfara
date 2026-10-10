import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Das Blatt des gedruckten Reiseplans (req-080): A4 hoch, randlos.
 *
 * jsdom fuehrt kein CSS aus -- geprueft wird deshalb direkt am Stylesheet,
 * dass das Blatt die Maße von A4 hoch traegt und der Druck ohne Rand
 * herauskommt (siehe eckdaten-card.layout.test.ts). Der Pfad wird ueber
 * process.cwd() gebaut und nicht ueber import.meta.url: `fileURLToPath` steht
 * in dieser Umgebung nicht ueberall zur Verfuegung.
 */
function readCss(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/** Der Rumpf der ersten Regel, deren Selektor genau so dasteht. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

const css = readCss("app/plan/reiseplan/reiseplan-druck.module.css");

describe("Reiseplan zum Ausdrucken -- A4 hoch (req-080)", () => {
  it("setzt die Seite auf A4 hoch ohne Rand", () => {
    const seite = css.match(/@page\s*{[^}]*}/)?.[0] ?? "";

    expect(seite).toMatch(/size:\s*A4 portrait/);
    expect(seite).toMatch(/margin:\s*0/);
  });

  it("gibt dem Blatt die Maße von A4 hoch", () => {
    const blatt = rule(css, ".seite");

    expect(blatt).toMatch(/width:\s*210mm/);
    expect(blatt).toMatch(/min-height:\s*297mm/);
  });

  it("bricht nach jedem Blatt um -- und nicht hinter dem letzten", () => {
    expect(rule(css, ".seite")).toMatch(/break-after:\s*page/);
    expect(rule(css, ".seite:last-of-type")).toMatch(/break-after:\s*auto/);
  });

  it("haelt den Textsatz 15 mm von der Blattkante", () => {
    expect(css).toMatch(/--rand:\s*15mm/);
    expect(rule(css, ".satz")).toMatch(/padding:\s*var\(--rand\)/);
  });

  it("laesst Farbflaechen und Fotos bis an die Blattkante laufen", () => {
    // Das Titelbild und das Dashboard sitzen am Rand des Blattes, nicht im
    // Satzspiegel.
    expect(rule(css, ".titelBild")).toMatch(/inset:\s*0 0 auto 0/);
    expect(rule(css, ".dashboard")).toMatch(/inset:\s*172mm 0 0 0/);
  });

  it("druckt die Farbflaechen mit, statt sie weiss zu lassen", () => {
    const heft = rule(css, ".heft");

    expect(heft).toMatch(/-webkit-print-color-adjust:\s*exact/);
    expect(heft).toMatch(/[^-]print-color-adjust:\s*exact/);
  });

  it("nimmt im Druck den Tisch, den Schatten und den Hinweis weg", () => {
    const druck = css.slice(css.indexOf("@media print"));

    expect(druck).toMatch(/\.heft\s*{[^}]*background:\s*none/);
    expect(druck).toMatch(/\.seite\s*{[^}]*margin:\s*0/);
    expect(druck).toMatch(/\.seite\s*{[^}]*box-shadow:\s*none/);
    expect(druck).toMatch(/\.nurBildschirm\s*{[^}]*display:\s*none/);
  });

  it("zerschneidet keine Station ueber zwei Blaetter", () => {
    expect(rule(css, ".station")).toMatch(/break-inside:\s*avoid/);
    expect(rule(css, ".station")).toMatch(/page-break-inside:\s*avoid/);
  });

  it("benutzt die Schriften der App und laedt keine fremden nach", () => {
    expect(css).toMatch(/var\(--font-heading\)/);
    expect(css).toMatch(/var\(--font-body\)/);
    expect(css).toMatch(/var\(--font-hand\)/);
    // Kein @import und kein url() auf einen fremden Dienst (stack.md).
    expect(css).not.toMatch(/@import/);
    expect(css).not.toMatch(/fonts\.googleapis\.com/);
  });

  it("traegt die Farben des Mockups und nicht die der App", () => {
    expect(css).toMatch(/--nacht:\s*#141a33/);
    expect(css).toMatch(/--papier:\s*#fbfaf7/);
    expect(css).toMatch(/--rot:\s*#b5341f/);
    expect(css).toMatch(/--safran:\s*#c8871a/);
  });
});
