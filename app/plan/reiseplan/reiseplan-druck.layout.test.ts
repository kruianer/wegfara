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

/**
 * Die Maße der fuenf Layouts stehen im Mockup (req-080). Weichen sie hier
 * ab, ist es ein Fehler -- die grossen Bilder sind absichtlich
 * unterschiedlich gross.
 */
describe("Reiseplan zum Ausdrucken -- die fuenf Layouts (req-080)", () => {
  it("L1: grosses Bild links 95 × 72 mm, zwei kleine unter dem Text", () => {
    expect(rule(css, ".l1 .koerper")).toMatch(
      /grid-template-columns:\s*95mm minmax\(0, 1fr\)/,
    );
    expect(rule(css, ".l1 .bild.gross")).toMatch(/height:\s*72mm/);
    expect(rule(css, ".l1 .kleine")).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    );
  });

  it("L2: Text links, grosses Bild rechts 88 × 54 mm, drei kleine darunter", () => {
    expect(rule(css, ".l2 .koerper")).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) 88mm/,
    );
    expect(rule(css, ".l2 .bild.gross")).toMatch(/height:\s*54mm/);
    expect(rule(css, ".l2 .kleine")).toMatch(
      /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
  });

  it("L3: grosses Bild oben 62 mm, Text darunter, drei kleine rechts", () => {
    expect(rule(css, ".l3 .bild.gross")).toMatch(/height:\s*62mm/);
    expect(rule(css, ".l3 .unten")).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) 72mm/,
    );
    expect(rule(css, ".l3 .kleine")).toMatch(
      /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
  });

  it("L4: Text zuerst, darunter eine Bildreihe aus gross und zwei kleinen", () => {
    expect(rule(css, ".l4 .bildreihe")).toMatch(
      /grid-template-columns:\s*2fr minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    );
    expect(rule(css, ".l4 .bildreihe .bild")).toMatch(/height:\s*44mm/);
  });

  it("L5: Nebenstation, schmal -- ein kleines Bild von 46 × 30 mm", () => {
    expect(rule(css, ".l5")).toMatch(
      /grid-template-columns:\s*46mm minmax\(0, 1fr\)/,
    );
    expect(rule(css, ".l5 .bild")).toMatch(/height:\s*30mm/);
    // Sie ist durch eine Linie abgesetzt statt durch ihre Groesse allein.
    expect(rule(css, ".l5")).toMatch(/border-left:/);
  });

  it("laesst eine Bildreihe mit nur einem Foto darauf zusammenfallen", () => {
    expect(rule(css, ".nurEines")).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(rule(css, ".l4 .bildreihe.nurEines .bild")).toMatch(
      /height:\s*52mm/,
    );
  });

  it("setzt die Alternative einer Options-Gruppe mit einem Band in Safran ab", () => {
    expect(rule(css, ".nebenbei")).toMatch(
      /border-left:\s*0\.6mm solid var\(--safran\)/,
    );
  });
});

/**
 * Die letzte Seite (req-080): keine Tabelle mit Kopfzeile, sondern eine
 * Liste -- und die Summe in einem Block in Mitternachtsblau mit dem Betrag
 * in Safran.
 */
describe("Reiseplan zum Ausdrucken -- die Kostenseite (req-080)", () => {
  it("setzt die Positionen als Liste mit Trennlinien", () => {
    expect(rule(css, ".posten")).toMatch(/border-top:/);
    expect(rule(css, ".position")).toMatch(/border-bottom:/);
    expect(rule(css, ".position")).toMatch(/display:\s*flex/);
  });

  it("stellt den Summenblock in Mitternachtsblau mit dem Betrag in Safran", () => {
    expect(rule(css, ".summeBlock")).toMatch(/background:\s*var\(--nacht\)/);
    expect(rule(css, ".summeBlock .gesamt")).toMatch(
      /color:\s*var\(--safran\)/,
    );
  });

  it("setzt eine offene Position leiser als einen Betrag", () => {
    expect(rule(css, ".betrag.offen")).toMatch(/font-style:\s*italic/);
    expect(rule(css, ".betrag.offen")).toMatch(/color:\s*var\(--nacht-3\)/);
  });

  it("zerschneidet keine Position ueber zwei Blaetter", () => {
    expect(rule(css, ".position")).toMatch(/break-inside:\s*avoid/);
  });
});

/**
 * req-080: Ein Tag ohne Programmpunkte bleibt als Seite stehen -- sein
 * Hinweis sitzt dabei in der Mitte des Blattes, nicht oben am Rand.
 */
describe("Reiseplan zum Ausdrucken -- der offene Tag (req-080)", () => {
  it("stellt den Hinweis in die Mitte des Blattes", () => {
    const leer = rule(css, ".leerTag");

    expect(leer).toMatch(/flex:\s*1/);
    expect(leer).toMatch(/justify-content:\s*center/);
    expect(leer).toMatch(/align-items:\s*center/);
  });

  it("setzt seine erste Zeile in Handschrift und warmem Rot", () => {
    expect(rule(css, ".hand")).toMatch(/var\(--font-hand\)/);
    expect(rule(css, ".leerTag .hand")).toMatch(/color:\s*var\(--rot\)/);
  });
});
