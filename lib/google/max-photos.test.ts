// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MAX_PHOTOS } from "./places-client";

/**
 * Die Obergrenze fuer die Fotos eines POI steht an genau einer Stelle
 * (req-068): `MAX_PHOTOS` in lib/google/places-client.ts. Sie gilt fuer
 * beide Wege, auf denen Fotos hereinkommen -- die Abfrage bei Google und
 * das Anlegen des POI -- und wird von 3 auf 7 geaendert, indem man eine
 * Zahl austauscht.
 *
 * Dieser Test liest die Quellen, weil sich das nicht durch Aufrufen
 * nachweisen laesst: er verhindert, dass eine zweite Zahl daneben
 * entsteht, die beim naechsten Mal vergessen wird.
 */
const QUELLVERZEICHNISSE = ["app", "lib", "components"];

/** Wo die Obergrenze steht -- die eine Stelle. */
const DIE_EINE_STELLE = "lib/google/places-client.ts";

/**
 * Der dritte Weg, auf dem Fotos hereinkommen: die KI-Suche. Sie schnitt bis
 * bug-049 auf genau ein Foto zu und hielt sich damit an eine eigene Regel
 * neben der Obergrenze. Seither kuerzt sie gar nicht mehr -- was die Abfrage
 * bei Google liefert, ist bereits begrenzt. Sie wendet die Obergrenze also
 * nicht an und nennt sie darum auch nicht.
 */
const DIE_KI_SUCHE = "app/api/poi-search/route.ts";

function quelldateien(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return quelldateien(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

/** Der Pfad einer Quelldatei, relativ zur Wurzel und immer mit Schraegstrichen. */
function relativerPfad(file: string): string {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}

const quellen = QUELLVERZEICHNISSE.flatMap((dir) =>
  quelldateien(path.join(process.cwd(), dir)),
).map((file) => ({
  datei: relativerPfad(file),
  inhalt: readFileSync(file, "utf8"),
}));

/** Eine Fotoliste, die auf eine feste Zahl gekuerzt wird. */
const FESTE_ZAHL = /photo(?:Name|)s[^\n]*\.slice\(\s*0\s*,\s*\d+\s*\)/;

describe("Obergrenze der Fotos je POI (req-068)", () => {
  it("erfasst die Quellen der Anwendung tatsaechlich", () => {
    const dateien = quellen.map((q) => q.datei);

    expect(dateien).toContain(DIE_EINE_STELLE);
    expect(dateien).toContain("app/api/pois/route.ts");
    expect(dateien).toContain(DIE_KI_SUCHE);
  });

  it("steht an genau einer Stelle", () => {
    const stellen = quellen
      .filter(({ inhalt }) => /\bMAX_PHOTOS\s*=/.test(inhalt))
      .map(({ datei }) => datei);

    expect(stellen).toEqual([DIE_EINE_STELLE]);
  });

  it("nennt dort sieben", () => {
    expect(MAX_PHOTOS).toBe(7);
    const quelle = quellen.find((q) => q.datei === DIE_EINE_STELLE);

    expect(quelle?.inhalt).toContain("export const MAX_PHOTOS = 7;");
  });

  /**
   * Keine Ausnahme mehr (bug-049): auch die KI-Suche kuerzt die Fotoliste
   * nicht mehr auf eine eigene Zahl. Der Weg, auf dem ein POI entsteht, darf
   * die Anzahl seiner Fotos nicht aendern.
   */
  it("kuerzt nirgends eine Fotoliste auf eine Zahl daneben", () => {
    const daneben = quellen
      .filter(({ inhalt }) => FESTE_ZAHL.test(inhalt))
      .map(({ datei }) => datei);

    expect(daneben).toEqual([]);
  });

  it("gilt auf beiden Wegen: Abfrage bei Google und Anlegen des POI", () => {
    const anwender = quellen
      .filter(({ inhalt }) => /\bMAX_PHOTOS\b/.test(inhalt))
      .map(({ datei }) => datei);

    expect(anwender.sort()).toEqual(
      [DIE_EINE_STELLE, "app/api/pois/route.ts"].sort(),
    );
  });
});
