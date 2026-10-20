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

/**
 * bug-057: der Reisetitel oeffnet die Reiseliste und ist damit das
 * Bedienelement, das man im Begleiter am haeufigsten trifft -- er war nur so
 * hoch wie die Kachel daneben (38 px).
 */
describe("Kopfbereich des Begleiters -- Reisetitel als Tippziel (bug-057)", () => {
  it("gibt dem Reisetitel ein Tippziel von mindestens 44 px Hoehe", () => {
    const switcher = regel(readCss("./header.module.css"), "switcher");

    // Die Breite braucht keine Angabe: "flex: 1" gibt ihm den uebrigen Platz
    // der Zeile, gemessen wurden 191 px bei 375 px Bildschirmbreite.
    expect(switcher).toMatch(/min-height:\s*44px/);
    expect(switcher).toMatch(/flex:\s*1/);
  });

  it("laesst die groessere Trefferflaeche unsichtbar", () => {
    const switcher = regel(readCss("./header.module.css"), "switcher");

    // Der Knopf zeichnet weder Flaeche noch Rahmen -- deshalb aendert die
    // Mindesthoehe nichts am Bild (vgl. bug-025).
    expect(switcher).toMatch(/background:\s*none/);
    expect(switcher).toMatch(/border:\s*none/);
  });

  it("haelt die Kachel neben dem Titel bei ihren 38 px", () => {
    const tile = regel(readCss("./header.module.css"), "tile");

    // Sie zeichnet sich selbst (Flaeche, Anfangsbuchstabe) und ist kein
    // eigenes Bedienelement -- sie waechst nicht mit.
    expect(zahl(tile, "width")).toBe(38);
    expect(zahl(tile, "height")).toBe(38);
  });
});
