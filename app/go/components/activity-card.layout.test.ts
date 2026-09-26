import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Die Groesse des Tippziels wird deshalb direkt am CSS
// geprueft (siehe app/go/components/header.layout.test.ts).
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
  const wert = regelText.match(
    new RegExp(`${eigenschaft}:\\s*(-?[0-9.]+)`),
  )?.[1];
  return wert === undefined ? null : Number(wert);
}

/** Die vier Werte des Kurzschreibweise-Abstands, in px. */
function abstand(regelText: string): {
  oben: number;
  rechts: number;
  unten: number;
  links: number;
} | null {
  const werte = regelText.match(/margin:\s*([^;]+);/)?.[1];
  if (werte === undefined) return null;
  const teile = werte.trim().split(/\s+/).map(parseFloat);
  const [oben, rechts = oben, unten = oben, links = rechts] = teile;
  return { oben, rechts, unten, links };
}

/**
 * bug-057: "Mehr lesen" war 61x13 px gross -- ein reiner Textknopf mit
 * "padding: 0" (stack.md, Bildschirmbreiten, Regel 4). Eine ueberlagernde
 * Trefferflaeche (das Muster aus bug-029) kam nicht in Frage: sie haette den
 * Buchungs-Knopf direkt darunter verdeckt.
 */
describe('Programmpunkt im Begleiter -- "Mehr lesen" als Tippziel (bug-057)', () => {
  const css = readCss("./activity-card.module.css");
  const toggle = regel(css, "toggle");

  it("gibt dem Knopf ein Tippziel von mindestens 44x44 px", () => {
    expect(toggle).toMatch(/min-height:\s*44px/);
    expect(toggle).toMatch(/min-width:\s*44px/);
    // Mindestmass, nicht festes Mass: die Beschriftung macht ihn breiter.
    expect(toggle).toMatch(/display:\s*inline-flex/);
    expect(toggle).toMatch(/align-items:\s*center/);
  });

  it("laesst die groessere Trefferflaeche unsichtbar", () => {
    // Gezeichnet wird allein die Beschriftung -- weder Flaeche noch Rahmen
    // wachsen mit (vgl. bug-025).
    expect(toggle).toMatch(/background:\s*none/);
    expect(toggle).toMatch(/border:\s*none/);
    expect(toggle).toMatch(/padding:\s*0/);
  });

  it("zieht die Karte dabei nicht auseinander", () => {
    const werte = abstand(toggle);

    // Die negativen Abstaende fallen in die unsichtbare Flaeche: von den
    // 44 px bleiben 24 px im Layout stehen.
    expect(werte).not.toBeNull();
    expect(werte!.oben).toBeLessThan(0);
    expect(werte!.unten).toBeLessThan(0);
    expect(44 + werte!.oben + werte!.unten).toBeLessThanOrEqual(24);
  });

  it("reicht nicht in das letzte der weiteren Fotos hinein (req-079)", () => {
    const werte = abstand(toggle)!;
    const fotos = abstand(regel(css, "weitereFotos"))!;

    // Aufgeklappt stehen die weiteren Fotos ueber dem Knopf (req-079). In
    // einen Text darf seine unsichtbare Flaeche hineinreichen -- in ein Bild
    // nicht: ein Tipp darauf klappte die Kachel zu, wo nichts darauf hindeutet.
    expect(fotos.unten + werte.oben).toBeGreaterThan(0);
  });

  it("verdeckt den Buchungs-Knopf darunter nicht", () => {
    const werte = abstand(toggle)!;
    const actions = zahl(regel(css, "actions"), "margin-top")!;

    // Regel 2 und 3 derselben Vorgabe: der Buchungs-Knopf steht direkt
    // darunter. Der Abstand nach unten darf deshalb nur so weit negativ sein,
    // dass zwischen Trefferflaeche und Knopf Platz bleibt.
    expect(actions + werte.unten).toBeGreaterThan(0);
  });
});

/**
 * Die Kachel traegt seit req-079 ein Foto, den Langtext mit weiteren Fotos und
 * eine Leiste mit Links. Bei 375, 768 und 1280 px muss all das benutzbar
 * bleiben (stack.md, Bildschirmbreiten). jsdom fuehrt kein Layout aus --
 * geprueft wird deshalb am CSS, wie in components/foto-ansicht.layout.test.ts.
 */
describe("Kachel im Begleiter bei 375, 768 und 1280 px (req-079)", () => {
  const css = readCss("./activity-card.module.css");

  it("haelt das Foto in der Breite der Kachel (Regel 1)", () => {
    // Das Bild richtet sich nach der Kachel, nicht nach seiner eigenen
    // Groesse: bei 375 px wie bei 1280 px steht es nicht ueber den Rand.
    const bild = regel(css, "photoImage");
    expect(bild).toMatch(/width:\s*100%/);
    expect(bild).toMatch(/object-fit:\s*cover/);
    expect(regel(css, "photo")).toMatch(/overflow:\s*hidden/);
    expect(regel(css, "card")).toMatch(/overflow:\s*hidden/);
    expect(regel(css, "card")).toMatch(/min-width:\s*0/);
  });

  it("haelt auch die weiteren Fotos in der Breite der Kachel", () => {
    const bild = regel(css, "weiteresFotoBild");
    expect(bild).toMatch(/width:\s*100%/);
    expect(bild).toMatch(/object-fit:\s*cover/);
    // Untereinander, nicht nebeneinander -- sonst wuerden sie bei 375 px
    // zusammengedrueckt.
    expect(regel(css, "weitereFotos")).toMatch(/flex-direction:\s*column/);
  });

  it("laesst Titel und Texte umbrechen, statt sie hinausragen zu lassen", () => {
    for (const klasse of ["title", "shortText", "longText", "ohneMich"]) {
      expect(regel(css, klasse)).toMatch(/overflow-wrap:\s*anywhere/);
    }
  });

  it("bricht die untere Leiste um, statt ihre Felder zu drueckeln (Regel 1 und 3)", () => {
    // Buchungszustand und Buchungs-Knopf stehen nebeneinander; bei 375 px
    // passen beide nicht immer in eine Zeile.
    const actions = regel(css, "actions");
    expect(actions).toMatch(/display:\s*flex/);
    expect(actions).toMatch(/flex-wrap:\s*wrap/);
    expect(regel(css, "buchung")).toMatch(/white-space:\s*nowrap/);
  });
});
