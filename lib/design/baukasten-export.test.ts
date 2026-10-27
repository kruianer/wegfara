import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BAUKASTEN_ORDNER,
  DATEIEN,
  loeseComposes,
} from "../../scripts/baukasten-export.mjs";
import { FARBWELT_PLANER, SCREEN_WIDTHS_PX, TIPPZIEL_PX } from "./stil";
import { PRUEF_HOEHE_PX } from "./bildschirm-regeln";

/**
 * Der Baukasten der Seiten-Mockups (req-091) ist erzeugt, nicht geschrieben:
 * baukasten.css und pruef.js entstehen mit `npm run baukasten` aus den
 * Quellen der App. Weicht die eingecheckte Fassung ab, hat jemand einen
 * Baustein geaendert und das Skript vergessen -- oder die Datei von Hand
 * bearbeitet.
 */
describe("Baukasten der Mockups -- erzeugt aus den Quellen der App (req-091)", () => {
  it.each(Object.keys(DATEIEN))("%s ist aktuell", (name) => {
    const eingecheckt = readFileSync(path.join(BAUKASTEN_ORDNER, name), "utf8");
    const erzeugt = DATEIEN[name as keyof typeof DATEIEN]();
    // Kein toBe: die Meldung waere tausende Zeilen lang.
    expect(
      eingecheckt === erzeugt,
      `${name} ist veraltet -- \`npm run baukasten\` ausfuehren`,
    ).toBe(true);
  });

  it("traegt die Farbwelt des Planers auch an den Klassen, die sie per composes holen", () => {
    const css = DATEIEN["baukasten.css"]();
    expect(css).toMatch(/\.farbwelt-planer,\n\.seite \{/);
    for (const [name, wert] of Object.entries(FARBWELT_PLANER)) {
      expect(css).toContain(`${name}: ${wert};`);
    }
    expect(css).not.toMatch(/composes:/);
  });

  it("traegt die helle Farbschicht des Begleiters an seiner Wurzel", () => {
    const css = DATEIEN["baukasten.css"]();
    expect(css).toMatch(
      /\.farbwelt-begleiter,\n\.goSeite \{\n {2}--bg: #f6f5f3;/,
    );
  });

  it("uebertraegt composes aus global und laesst die Regel sonst unberuehrt", () => {
    const { css, traeger } = loeseComposes(
      ".a {\n  composes: welt from global;\n\n  color: red;\n}\n.b { color: blue; }",
    );
    expect(css).toBe(".a {\n  color: red;\n}\n.b { color: blue; }");
    expect(traeger.get("welt")).toEqual([".a"]);
  });

  it("lehnt composes aus einem anderen Modul ab -- das gibt es im Mockup nicht", () => {
    expect(() =>
      loeseComposes(".a {\n  composes: b from './x.module.css';\n}"),
    ).toThrow(/composes/);
  });

  it("prueft mit den Breiten, der Hoehe und dem Tippziel der App", () => {
    const skript = DATEIEN["pruef.js"]();
    expect(skript).toContain(
      `starteMockupPruefung(${JSON.stringify({
        breiten: [...SCREEN_WIDTHS_PX],
        hoehe: PRUEF_HOEHE_PX,
        tippziel: TIPPZIEL_PX,
      })});`,
    );
    // Dieselben Regeln wie tests/e2e/screen-check.ts -- nicht eine Kopie.
    expect(skript).toContain("function sammleVerstoesse(MIN_TIPPZIEL");
    expect(skript).not.toMatch(/^import /m);
    expect(skript).not.toMatch(/^export /m);
  });
});
