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
 * Die Karte der POI-Auswahl (req-099): die farbige Schrift der Statuspille,
 * der weisse Text auf dem Typ-Band und die Nummer auf dem Bild, nach WCAG 2.1 (stack.md, Kontrast). Beide Farben kommen aus den
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

function regel(css: string, klasse: string) {
  return css.match(new RegExp(`\\.${klasse}\\s*{[^}]*}`))?.[0] ?? "";
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

function mische(a: Rgb, b: Rgb, anteilA: number): Rgb {
  return a.map((k, i) => k * anteilA + b[i] * (1 - anteilA)) as Rgb;
}

const css = readCss("./unplanned-column.module.css");

describe("POI-Auswahl -- Kontrast der Farben auf der Karte (req-099)", () => {
  it("haelt die farbige Statusschrift auf ihrer getoenten Pille lesbar", () => {
    const pille = regel(css, "statusPille");
    expect(pille).toMatch(/color:\s*var\(--status\)/);
    const anteil = Number(
      pille.match(
        /background:\s*color-mix\(in srgb, var\(--status\) (\d+)%, var\(--field\)\)/,
      )?.[1],
    );
    expect(anteil).toBeGreaterThan(0);

    for (const farbe of Object.values(POI_STATUS_COLOR)) {
      const grund = mische(
        rgb(farbe),
        rgb(FARBWELT_PLANER["--field"]),
        anteil / 100,
      );
      expect(
        kontrastVerhaeltnis(farbe, hex(grund)),
        farbe,
      ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    }
  });

  it("haelt den weissen Text auf dem Typ-Band lesbar -- ueber hellem wie dunklem Foto", () => {
    const band = regel(css, "typBand");
    expect(band).toMatch(/color:\s*#fff/);
    const m = band.match(
      /color-mix\(\s*in srgb,\s*var\(--typ\) (\d+)%,\s*color-mix\(in srgb, var\(--deep\) (\d+)%, transparent\)\s*\)/,
    );
    expect(m).not.toBeNull();
    const typAnteil = Number(m![1]) / 100;
    const tiefDeckung = Number(m![2]) / 100;
    const deckung = typAnteil + (1 - typAnteil) * tiefDeckung;
    const tief = rgb(FARBWELT_PLANER["--deep"]);

    for (const farbe of Object.values(POI_TYPE_COLOR)) {
      const typ = rgb(farbe);
      const vor = typ.map(
        (k, i) => k * typAnteil + tief[i] * (1 - typAnteil) * tiefDeckung,
      ) as Rgb;
      for (const foto of [0, 255]) {
        // Das Weltkulturerbe atmet bis 8 % heller.
        for (const hell of [1, 1.08]) {
          const grund = vor.map(
            (k) => (k + (1 - deckung) * foto) * hell,
          ) as Rgb;
          expect(
            kontrastVerhaeltnis("#ffffff", hex(grund)),
            `${farbe} ueber ${foto ? "hellem" : "dunklem"} Foto`,
          ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
        }
      }
    }
  });

  it("haelt die weisse Nummer auf ihrem Grund lesbar, auch ueber hellem Foto", () => {
    const deckung =
      Number(
        regel(css, "nummer").match(
          /background:\s*color-mix\(in srgb, var\(--deep\) (\d+)%, transparent\)/,
        )?.[1],
      ) / 100;
    expect(deckung).toBeGreaterThan(0);
    const grund = mische(
      rgb(FARBWELT_PLANER["--deep"]),
      [255, 255, 255],
      deckung,
    );
    expect(kontrastVerhaeltnis("#ffffff", hex(grund))).toBeGreaterThanOrEqual(
      MINDESTKONTRAST_FLIESSTEXT,
    );
  });
});
