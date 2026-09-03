// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * In wessen Account gearbeitet wird, ergibt sich seit req-024
 * ausschliesslich aus der Anmeldung. Im Quelltext der Anwendung steht dazu
 * keine Kennung mehr -- weder als Konstante noch als Vorgabewert.
 *
 * Seit req-025 kann das der eigene Account der angemeldeten Person sein
 * oder der fremde, in den der Gesamt-Admin gewechselt hat: massgeblich ist
 * `session.accountId`. Die Regel bleibt dieselbe -- der Account kommt aus
 * der Sitzung, nie aus der Anfrage.
 *
 * Dieser Test liest die Quellen, weil sich das nicht durch Aufrufen
 * nachweisen laesst: er verhindert, dass eine feste Kennung ueber eine neue
 * Datei zurueckkommt.
 */
const QUELLVERZEICHNISSE = ["app", "lib", "components"];

/**
 * Die einzige Ausnahme (req-025): der Gesamt-Admin waehlt beim Wechseln
 * genau einmal einen Account aus, und dafuer muss dessen Kennung aus der
 * Anfrage kommen. Danach steht sie in der Sitzung und nie wieder in einer
 * Anfrage. Beide Stellen pruefen vorher die Kennzeichnung -- genau das
 * verlangt der Test unten.
 */
const ACCOUNT_AUS_DER_ANFRAGE = [
  "app/api/accounts/wechsel/route.ts",
  "app/api/accounts/einladung/route.ts",
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function quelldateien(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return quelldateien(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    // Tests duerfen die Kennung der Demodaten nennen, um sie zu adressieren
    // (siehe tests/test-db.ts) -- die Anwendung nicht.
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

const quellen = QUELLVERZEICHNISSE.flatMap((dir) =>
  quelldateien(path.join(process.cwd(), dir)),
).map((file) => ({
  datei: path.relative(process.cwd(), file),
  inhalt: readFileSync(file, "utf8"),
}));

const mitAccountBezug = quellen.filter(({ inhalt }) =>
  /\baccountId\b/.test(inhalt),
);

describe("Account aus der Anmeldung (req-024)", () => {
  it("erfasst die Quellen der Anwendung tatsaechlich", () => {
    const dateien = quellen.map((q) => q.datei);

    expect(dateien).toContain("app/plan/page.tsx");
    expect(dateien).toContain("app/go/page.tsx");
    expect(dateien.length).toBeGreaterThan(50);
    expect(mitAccountBezug.length).toBeGreaterThan(0);
  });

  it("enthaelt keine fest hinterlegte Kennung", () => {
    const treffer = quellen
      .filter(({ inhalt }) => UUID.test(inhalt))
      .map(({ datei }) => datei);

    expect(treffer).toEqual([]);
  });

  it("kennt keine Konstante ACCOUNT_ID", () => {
    const treffer = quellen
      .filter(({ inhalt }) => inhalt.includes("ACCOUNT_ID"))
      .map(({ datei }) => datei);

    expect(treffer).toEqual([]);
  });

  it("nimmt den Account in jeder Schnittstelle aus der Sitzung", () => {
    const ohneSitzung = mitAccountBezug
      .filter(
        ({ datei, inhalt }) =>
          datei.startsWith("app/") &&
          datei.endsWith("route.ts") &&
          !ACCOUNT_AUS_DER_ANFRAGE.includes(datei) &&
          !/session\.accountId\b/.test(inhalt),
      )
      .map(({ datei }) => datei);

    expect(ohneSitzung).toEqual([]);
  });

  it("nimmt den Account nirgends aus der Anfrage -- ausser beim Wechseln", () => {
    const ausDerAnfrage = mitAccountBezug
      .filter(
        ({ inhalt }) =>
          /body\.accountId/.test(inhalt) ||
          /searchParams\.get\(\s*["']accountId["']\s*\)/.test(inhalt),
      )
      .map(({ datei }) => datei);

    expect(ausDerAnfrage.sort()).toEqual([...ACCOUNT_AUS_DER_ANFRAGE].sort());
  });

  it("laesst den Account nur den Gesamt-Admin waehlen (req-025)", () => {
    for (const datei of ACCOUNT_AUS_DER_ANFRAGE) {
      const quelle = quellen.find((q) => q.datei === datei);

      expect(quelle, `${datei} fehlt`).toBeDefined();
      expect(quelle?.inhalt).toContain("session.superAdmin");
      expect(quelle?.inhalt).toContain("forbidden()");
    }
  });
});
