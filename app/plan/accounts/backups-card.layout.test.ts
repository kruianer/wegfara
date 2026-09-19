import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- geprueft wird deshalb direkt am CSS statt am
// gerenderten DOM (siehe eckdaten-card.layout.test.ts, bug-019).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Der Rumpf der ersten Regel, deren Selektor genau so dasteht. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * Die Backup-Karte der "Verwaltung" traegt seit req-071 zwei Wege mehr:
 * Herunterladen je Zeile und Hochladen unter der Liste. Beide muessen bei
 * 375, 768 und 1280 px erreichbar bleiben (stack.md, Bildschirmbreiten).
 */
describe("backups-card Layout (req-071)", () => {
  const css = readCss("./backups-card.module.css");

  it("laesst die drei Wege einer Zeile umbrechen, statt sie ueber den Rand zu schieben", () => {
    // Bei 375 px stehen "Herunterladen", "Wiederherstellen" und "Löschen"
    // nicht mehr nebeneinander (Regel 1). Die Gruppe darf dafuer schmaler
    // werden als ihr Inhalt -- mit flex: none bliebe sie auf voller Breite
    // stehen und wuerde hinausragen.
    const aktionen = rule(css, ".rowActions");
    expect(aktionen).toMatch(/flex-wrap:\s*wrap/);
    expect(aktionen).toMatch(/flex:\s*1 1 auto/);
    expect(aktionen).toMatch(/min-width:\s*0/);
  });

  it("gibt Herunterladen dasselbe Tippziel wie den Schaltflaechen daneben", () => {
    // Regel 4: Der Link wird auf dem iPad mit dem Finger bedient.
    const knoepfe = rule(css, ".actionButton,\n.actionLink");
    expect(knoepfe).toMatch(/min-height:\s*44px/);
    expect(knoepfe).toMatch(/display:\s*inline-flex/);
  });

  it("laesst „Backup erstellen“ und „Backup hochladen“ umbrechen", () => {
    const leiste = rule(css, ".actions");
    expect(leiste).toMatch(/display:\s*flex/);
    expect(leiste).toMatch(/flex-wrap:\s*wrap/);
  });

  it("gibt „Backup hochladen“ ein Tippziel von 44 px", () => {
    // Die Beschriftung ist die Schaltflaeche -- sie traegt .addButton.
    expect(rule(css, ".addButton")).toMatch(/min-height:\s*44px/);
  });

  it("haelt das Dateifeld in seiner Beschriftung fest", () => {
    // Absolut gesetzt, aber ohne Bezugspunkt wuerde es an der Seite kleben
    // und bei 375 px seitliches Scrollen ausloesen (Regel 1).
    expect(rule(css, ".addButton")).toMatch(/position:\s*relative/);
    const feld = rule(css, ".fileInput");
    expect(feld).toMatch(/position:\s*absolute/);
    expect(feld).toMatch(/opacity:\s*0/);
    // display: none waere mit der Tastatur nicht erreichbar (Regel 3).
    expect(feld).not.toMatch(/display:\s*none/);
  });

  it("laesst die Zeile selbst umbrechen, damit Text und Wege Platz haben", () => {
    const zeile = rule(css, ".row");
    expect(zeile).toMatch(/flex-wrap:\s*wrap/);
    expect(rule(css, ".rowBody")).toMatch(/min-width:\s*0/);
  });

  it("laesst die Karte auf schmale Bildschirme schrumpfen", () => {
    // Eine Hoechstbreite statt einer festen Breite: bei 1280 px bleibt sie
    // lesbar schmal, bei 375 px fuellt sie die Breite.
    const karte = rule(css, ".card");
    expect(karte).toMatch(/max-width:\s*760px/);
    expect(karte).not.toMatch(/(?<!-)width:\s*\d/);
  });
});
