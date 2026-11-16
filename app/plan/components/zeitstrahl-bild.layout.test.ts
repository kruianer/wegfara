import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { masse, ZEITSTRAHL_BILD_PX } from "@/lib/design/stil";

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
