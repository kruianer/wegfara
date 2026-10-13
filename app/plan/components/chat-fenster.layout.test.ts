import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * jsdom fuehrt kein CSS aus -- ob das Chatfenster auf 1280 px benutzbar
 * bleibt (req-081), wird deshalb direkt am Blatt geprueft statt am
 * gerenderten DOM (wie in eckdaten-card.layout.test.ts).
 *
 * Geprueft werden die vier Regeln aus stack.md: nichts steht ueber den Rand,
 * nichts ueberlappt, alles Bedienbare ist erreichbar, Tippziele sind
 * mindestens 44x44 px.
 *
 * Der Pfad wird ueber process.cwd() gebaut und nicht ueber import.meta.url:
 * `fileURLToPath` steht in dieser Umgebung nicht ueberall zur Verfuegung
 * (siehe reiseplan-druck.layout.test.ts).
 */
function readCss(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/** Der Rumpf der ersten Regel, deren Selektor genau so dasteht. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

const css = readCss("app/plan/components/chat-fenster.module.css");

describe("Chatfenster -- Layout (req-081)", () => {
  /**
   * Regel 3: Alles Bedienbare ist erreichbar. Waechst die Spalte mit dem
   * Verlauf, rutscht das Feld unten aus dem Bild -- nur der Verlauf in der
   * Mitte darf rollen.
   */
  it("laesst allein den Verlauf rollen und das Feld stehen", () => {
    const fenster = rule(css, ".fenster");
    expect(fenster).toMatch(/display:\s*flex/);
    expect(fenster).toMatch(/flex-direction:\s*column/);
    expect(fenster).toMatch(/min-height:\s*0/);

    const verlauf = rule(css, ".verlauf");
    expect(verlauf).toMatch(/flex:\s*1/);
    expect(verlauf).toMatch(/min-height:\s*0/);
    expect(verlauf).toMatch(/overflow-y:\s*auto/);

    // Kopf und Feld wachsen und schrumpfen nicht mit.
    expect(rule(css, ".kopf")).toMatch(/flex:\s*none/);
    expect(rule(css, ".form")).toMatch(/flex:\s*none/);
  });

  /** Regel 1: Nichts steht ueber den Rand. */
  it("haelt den Inhalt in der Spalte", () => {
    expect(rule(css, ".fenster")).toMatch(/min-width:\s*0/);
    expect(rule(css, ".verlauf")).toMatch(/min-width:\s*0/);

    // Ein Formularelement haelt sich von sich aus auf der Breite seines
    // Inhalts und zieht die Spalte auf (vgl. bug-019).
    const feld = rule(css, ".feld");
    expect(feld).toMatch(/min-width:\s*0/);
    expect(feld).toMatch(/max-width:\s*100%/);
    expect(feld).toMatch(/box-sizing:\s*border-box/);

    const modellFeld = rule(css, ".modellFeld");
    expect(modellFeld).toMatch(/min-width:\s*0/);
    expect(modellFeld).toMatch(/max-width:\s*100%/);
  });

  /**
   * Eine lange Adresse oder ein langes Wort in der Antwort bricht um, statt
   * die Blase ueber den Rand zu schieben.
   */
  it("bricht lange Woerter in den Blasen um", () => {
    for (const selector of [".blaseIch", ".blaseKi"]) {
      const blase = rule(css, `.blaseIch,\n.blaseKi`);
      expect(blase, selector).toMatch(/overflow-wrap:\s*anywhere/);
      expect(blase, selector).toMatch(/max-width:\s*82%/);
      expect(blase, selector).toMatch(/min-width:\s*0/);
    }
  });

  /** Regel 4: Tippziele sind mindestens 44x44 px (stack.md). */
  it("gibt Senden-Knopf und Modellauswahl ein Tippziel von 44 px", () => {
    const senden = rule(css, ".senden");
    expect(senden).toMatch(/min-height:\s*44px/);
    expect(senden).toMatch(/box-sizing:\s*border-box/);
    // Breiter als 44 px, damit "Antwortet…" hineinpasst, ohne zu springen.
    expect(senden).toMatch(/min-width:\s*96px/);

    const modellFeld = rule(css, ".modellFeld");
    expect(modellFeld).toMatch(/min-height:\s*44px/);
    expect(modellFeld).toMatch(/box-sizing:\s*border-box/);
  });

  /**
   * Regel 2: Nichts ueberlappt. Kopf, Verlauf und Feld liegen in einer
   * Spalte untereinander, und das Fenster fuellt seine Spalte genau.
   */
  it("legt die drei Teile untereinander in ihre Spalte", () => {
    const fenster = rule(css, ".fenster");
    expect(fenster).toMatch(/position:\s*absolute/);
    expect(fenster).toMatch(/inset:\s*0/);
    expect(fenster).toMatch(/overflow:\s*hidden/);
  });
});
