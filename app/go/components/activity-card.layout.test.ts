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

  it("verdeckt den Buchungs-Knopf darunter nicht", () => {
    const werte = abstand(toggle)!;
    const actions = zahl(regel(css, "actions"), "margin-top")!;

    // Regel 2 und 3 derselben Vorgabe: der Buchungs-Knopf steht direkt
    // darunter. Der Abstand nach unten darf deshalb nur so weit negativ sein,
    // dass zwischen Trefferflaeche und Knopf Platz bleibt.
    expect(actions + werte.unten).toBeGreaterThan(0);
  });
});
