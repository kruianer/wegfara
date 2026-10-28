import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  kontrastVerhaeltnis,
  MINDESTKONTRAST_FLIESSTEXT,
} from "@/lib/design/kontrast";
import { POI_STATUS_COLOR } from "@/lib/pois/status-meta";
import { POI_TYPE_COLOR } from "@/lib/pois/type-meta";
import { FARBWELT_PLANER } from "@/lib/design/stil";

/**
 * Die farbigen Pillen des Filterblatts und die Chips der gesetzten Filter
 * (req-098), nach WCAG 2.1 (stack.md, Kontrast). Die Farben kommen aus den
 * bestehenden Konstanten; das Blatt mischt sie mit `color-mix` -- die Anteile
 * werden hier aus dem Blatt gelesen und nachgerechnet.
 *
 * jsdom fuehrt kein CSS aus -- geprueft wird deshalb direkt am Blatt.
 */
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function regel(css: string, selektor: string) {
  // Nur Regeln, die mit dem Selektor beginnen -- nicht ".leise .chipFlaeche".
  return css.match(new RegExp(`(?:^|\\n)${selektor}\\s*{[^}]*}`))?.[0] ?? "";
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const wert = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(wert.slice(i, i + 2), 16)) as Rgb;
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((k) =>
      Math.round(Math.min(255, Math.max(0, k)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** color-mix(in srgb, farbe anteil%, --field) */
function getoent(farbe: string, anteil: number): string {
  const a = rgb(farbe);
  const b = rgb(FARBWELT_PLANER["--field"]);
  return hex(a.map((k, i) => k * anteil + b[i] * (1 - anteil)) as Rgb);
}

/** Der Anteil der Farbe am Grund, aus der Regel gelesen. */
function anteil(regelText: string): number {
  const wert = Number(
    regelText.match(
      /background:\s*color-mix\(in srgb, var\(--c\) (\d+)%, var\(--field\)\)/,
    )?.[1],
  );
  expect(wert).toBeGreaterThan(0);
  return wert / 100;
}

const css = readCss("./poi-listen-kopf.module.css");
const F = FARBWELT_PLANER as Record<string, string>;

describe("Kopf der POI-Liste -- Kontrast der Pillen und Chips (req-098)", () => {
  it("haelt die farbige Schrift einer gewaehlten Status-Pille lesbar", () => {
    const an = anteil(regel(css, "\\.an"));
    expect(regel(css, "\\.an")).toMatch(/color:\s*var\(--c\)/);
    for (const farbe of Object.values(POI_STATUS_COLOR)) {
      expect(
        kontrastVerhaeltnis(farbe, getoent(farbe, an)),
        farbe,
      ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    }
  });

  it("schreibt eine gewaehlte Typ-Pille hell -- manche Typfarbe ist zu dunkel", () => {
    const an = anteil(regel(css, "\\.an"));
    expect(regel(css, "\\.pilleTyp\\.an")).toMatch(/color:\s*var\(--text\)/);
    for (const farbe of Object.values(POI_TYPE_COLOR)) {
      expect(
        kontrastVerhaeltnis(F["--text"], getoent(farbe, an)),
        farbe,
      ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    }
  });

  it("haelt Gegend und Sortierung im Akzent lesbar", () => {
    const an = anteil(regel(css, "\\.an"));
    expect(regel(css, "\\.pilleNeutral\\.an")).toMatch(
      /color:\s*var\(--acc-text\)/,
    );
    expect(
      kontrastVerhaeltnis(F["--acc-text"], getoent(F["--acc"], an)),
    ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
  });

  it("haelt die ungewaehlte Pille lesbar", () => {
    expect(regel(css, "\\.pillenFlaeche")).toMatch(/color:\s*var\(--text-3\)/);
    expect(
      kontrastVerhaeltnis(F["--text-3"], F["--field"]),
    ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
  });

  it("haelt die Schrift der Chips lesbar -- farbig wie neutral", () => {
    const chip = regel(css, "\\.chipFlaeche");
    const teil = anteil(chip);
    expect(chip).toMatch(/color:\s*var\(--c\)/);
    for (const farbe of [...Object.values(POI_STATUS_COLOR), F["--text-2"]]) {
      expect(
        kontrastVerhaeltnis(farbe, getoent(farbe, teil)),
        farbe,
      ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    }
  });
});
