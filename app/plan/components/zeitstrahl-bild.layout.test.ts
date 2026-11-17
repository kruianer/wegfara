import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FARBWELT_PLANER,
  masse,
  SCHRIFTSTUFEN,
  TYP_ZEICHEN_PX,
  ZEITSTRAHL_BILD_PX,
} from "@/lib/design/stil";
import {
  kontrastVerhaeltnis,
  MINDESTKONTRAST_FLIESSTEXT,
} from "@/lib/design/kontrast";
import { ACTIVITY_TYPE_COLOR } from "@/lib/activities/type-meta";

// jsdom fuehrt kein CSS aus -- wie das Teaserbild im Block liegt (req-111),
// wird deshalb am Stylesheet geprueft (siehe timeline-column.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const css = readCss("./timeline-column.module.css");
const komponente = readCss("./timeline-column.tsx");

function rule(selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("Teaserbild im Zeitstrahl -- Lage im Block (req-111)", () => {
  it("steht links ueber die ganze Hoehe des Blocks", () => {
    const teaser = rule("teaser");
    expect(teaser).toMatch(/position:\s*absolute/);
    expect(teaser).toMatch(/top:\s*0/);
    expect(teaser).toMatch(/bottom:\s*0/);
    expect(teaser).toMatch(/left:\s*0/);
  });

  it("ist in jedem Block gleich breit, und der Titel beginnt dahinter", () => {
    // Dieselbe Groesse an beiden Stellen -- und keine, die von der Hoehe des
    // Blocks abhinge.
    expect(rule("teaser")).toMatch(/width:\s*var\(--zeitstrahl-bild-breite\)/);
    expect(rule("mitBild")).toMatch(
      /padding-left:\s*calc\(var\(--zeitstrahl-bild-breite\)\s*\+\s*10px\)/,
    );
    expect(rule("teaser")).not.toMatch(/%/);
  });

  it("nennt die Breite an einer Stelle, in lib/design/stil.ts", () => {
    expect(masse()["--zeitstrahl-bild-breite"]).toBe(
      `${ZEITSTRAHL_BILD_PX.breite}px`,
    );
    const zahl = new RegExp(`\\b${ZEITSTRAHL_BILD_PX.breite}\\b`);
    for (const selector of ["mitBild", "teaser", "teaserBild"]) {
      expect(rule(selector)).not.toMatch(zahl);
    }
    expect(komponente).not.toMatch(zahl);
  });
});

describe("Teaserbild im Zeitstrahl -- kein Griff (req-111)", () => {
  it("nimmt keine Zeiger-Ereignisse an -- sie gehen an den Block", () => {
    expect(rule("teaser")).toMatch(/pointer-events:\s*none/);
  });

  it("laesst die Kanten mit ihrer Hoehe ueber dem Bild liegen", () => {
    // Die Kanten bleiben, wie sie waren (bug-022): sie liegen im Block nach
    // dem Bild und reichen ueber die ganze Breite.
    expect(rule("resizeHandle")).toMatch(/left:\s*0/);
    expect(rule("resizeHandle")).toMatch(/right:\s*0/);
    expect(rule("teaser")).not.toMatch(/z-index/);
  });
});

describe("Teaserbild im Zeitstrahl -- flacher Block (req-111)", () => {
  it("zeigt im flachen Block einen Ausschnitt aus der Bildmitte, nicht gestaucht", () => {
    const bild = rule("teaserBild");
    expect(bild).toMatch(/width:\s*100%/);
    expect(bild).toMatch(/height:\s*100%/);
    expect(bild).toMatch(/object-fit:\s*cover/);
    expect(bild).toMatch(/object-position:\s*center/);
  });

  it("schneidet die Nummer im flachsten Block nicht an (req-074)", () => {
    // Die Mindesthoehe bleibt mit ihrer Begruendung ...
    expect(rule("activityBlock")).toMatch(/min-height:\s*24px/);
    // ... das Bild liegt neben der Titelzeile und nicht darueber: der
    // Einzug des Titels ist breiter als das Bild.
    expect(rule("mitBild")).toMatch(
      /padding-left:\s*calc\(var\(--zeitstrahl-bild-breite\)\s*\+\s*\d+px\)/,
    );
    // Und das Bild aendert nichts an der Hoehe der Titelzeile: es steht
    // ausserhalb des Flusses.
    expect(rule("teaser")).toMatch(/position:\s*absolute/);
    expect(rule("activityNumber")).toMatch(/white-space:\s*nowrap/);
  });
});

describe("Teaserbild im Zeitstrahl -- Zeichen mit dem Typ (req-111)", () => {
  it("liegt als Band am unteren Rand des Bildes", () => {
    const zeichen = rule("typZeichen");
    expect(zeichen).toMatch(/position:\s*absolute/);
    expect(zeichen).toMatch(/bottom:\s*0/);
    expect(zeichen).toMatch(/background:\s*color-mix\(/);
    expect(zeichen).toMatch(/var\(--typ\)/);
  });

  it("nimmt Hoehe, Innenabstand und Schrift aus lib/design/stil.ts", () => {
    const zeichen = rule("typZeichen");
    expect(zeichen).toMatch(/height:\s*var\(--typ-zeichen-hoehe\)/);
    expect(zeichen).toMatch(/padding:\s*var\(--typ-zeichen-innenabstand\)/);
    expect(zeichen).toMatch(/font-size:\s*var\(--schrift-xxs\)/);
    expect(zeichen).toMatch(/line-height:\s*var\(--zeile-xxs\)/);
    expect(masse()["--typ-zeichen-hoehe"]).toBe(`${TYP_ZEICHEN_PX.hoehe}px`);
  });

  it("leitet die Hoehe, ab der es passt, aus seiner Schriftgroesse ab", () => {
    const zeile = SCHRIFTSTUFEN.xxs.groessePx * SCHRIFTSTUFEN.xxs.zeilenhoehe;
    expect(TYP_ZEICHEN_PX.hoehe).toBeGreaterThanOrEqual(
      zeile + 2 * TYP_ZEICHEN_PX.innenabstand,
    );
    // Ueber dem Band bleibt Bild; der flachste Block (24 px) traegt keines.
    expect(TYP_ZEICHEN_PX.minBlockHoehe).toBeGreaterThan(TYP_ZEICHEN_PX.hoehe);
    expect(TYP_ZEICHEN_PX.minBlockHoehe).toBeGreaterThan(24);
  });

  it("haelt den weissen Text lesbar -- ueber hellem wie dunklem Foto", () => {
    const m = rule("typZeichen").match(
      /color-mix\(\s*in srgb,\s*var\(--typ\) (\d+)%,\s*color-mix\(in srgb, var\(--deep\) (\d+)%, transparent\)\s*\)/,
    );
    expect(m).not.toBeNull();
    expect(rule("typZeichen")).toMatch(/color:\s*#fff/);
    const typAnteil = Number(m![1]) / 100;
    const tiefDeckung = Number(m![2]) / 100;
    const deckung = typAnteil + (1 - typAnteil) * tiefDeckung;
    const tief = rgb(FARBWELT_PLANER["--deep"]);
    for (const farbe of Object.values(ACTIVITY_TYPE_COLOR)) {
      const typ = rgb(farbe);
      for (const foto of [0, 255]) {
        const grund = typ.map(
          (k, i) =>
            k * typAnteil +
            tief[i] * (1 - typAnteil) * tiefDeckung +
            (1 - deckung) * foto,
        ) as Rgb;
        expect(
          kontrastVerhaeltnis("#ffffff", hex(grund)),
          `${farbe} ueber ${foto ? "hellem" : "dunklem"} Foto`,
        ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
      }
    }
  });
});

type Rgb = [number, number, number];

function rgb(wert: string): Rgb {
  const ziffern = wert.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(ziffern.slice(i, i + 2), 16)) as Rgb;
}

function hex(farbe: Rgb): string {
  return `#${farbe
    .map((k) =>
      Math.round(Math.min(255, Math.max(0, k)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
