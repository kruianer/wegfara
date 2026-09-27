import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  kontrastVerhaeltnis,
  MINDESTKONTRAST_FLIESSTEXT,
} from "@/lib/design/kontrast";
import { ACTIVITY_TYPE_COLOR } from "@/lib/activities/type-meta";

/**
 * Was ueber dem oberen Teil der Kachel steht -- Art, Uhrzeit und „Gewählt" --
 * liegt seit req-079 auf einem Foto und nicht mehr nur auf der farbigen
 * Flaeche des Typs. Lesbar bleibt es allein dann, wenn jedes der drei Felder
 * seinen eigenen, deckenden Grund mitbringt: auf einem durchscheinenden
 * Grund haengt der Kontrast daran, was zufaellig im Bild darunter liegt
 * (stack.md, Kontrast; dieselbe Regel wie beim Zeichen des KI-Bildes,
 * components/ki-bild-marke.module.css).
 *
 * jsdom fuehrt kein CSS aus -- geprueft wird deshalb direkt am Blatt (wie in
 * components/farbwelt.kontrast.test.ts).
 */
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function regel(css: string, klasse: string) {
  return css.match(new RegExp(`\\.${klasse}\\s*{[^}]*}`))?.[0] ?? "";
}

function eigenschaft(regelText: string, name: string): string | null {
  return (
    regelText.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() ?? null
  );
}

const css = readCss("./activity-card.module.css");

describe("Kachel im Begleiter – die Felder ueber dem Foto (req-079)", () => {
  it("gibt der Uhrzeit einen deckenden Grund statt eines durchscheinenden", () => {
    const grund = eigenschaft(regel(css, "timePill"), "background");

    // Vor req-079 stand hier rgba(20, 15, 8, 0.5) -- auf der farbigen Flaeche
    // genuegte das, auf einem dunklen Foto nicht mehr.
    expect(grund).not.toBeNull();
    expect(grund).toMatch(/^#[0-9a-f]{6}$/i);
    expect(kontrastVerhaeltnis(grund!, "#ffffff")).toBeGreaterThanOrEqual(
      MINDESTKONTRAST_FLIESSTEXT,
    );
  });

  it("gibt der Art und „Gewählt“ ihren Grund und hebt beide vom Foto ab", () => {
    // Die Art traegt die Farbe ihres Typs (aus type-meta.ts, am Element
    // selbst), "Gewählt" die Farbe --good; beide sind deckend. Was sie auf
    // einem Foto derselben Helligkeit sichtbar haelt, ist ihr Schatten --
    // ohne ihn verschwimmt die Kante.
    for (const farbe of Object.values(ACTIVITY_TYPE_COLOR)) {
      expect(farbe).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const klasse of ["typeChip", "selectedPill"]) {
      const feld = regel(css, klasse);
      expect(feld).not.toBe("");
      expect(feld).not.toMatch(/background:[^;]*rgba/);
      expect(feld).toMatch(/box-shadow:/);
    }
  });

  it("laesst das Foto nicht ueber die runden Ecken der Kachel hinausstehen", () => {
    // Die Kachel selbst schneidet ab (overflow: hidden); der obere Teil tut
    // es ebenso, damit das Zeichen des KI-Bildes daran haengen kann.
    expect(regel(css, "photo")).toMatch(/overflow:\s*hidden/);
    expect(regel(css, "photoImage")).toMatch(/object-fit:\s*cover/);
  });
});
