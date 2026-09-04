// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Jede Schnittstelle setzt eine angemeldete Person voraus (req-016). Die
 * middleware faengt nur den Fall ohne Sitzungs-Cookie ab -- die belastbare
 * Pruefung muss im Route-Handler selbst stehen. Dieser Test verhindert,
 * dass eine neu hinzugefuegte Schnittstelle sie vergisst.
 */
const API_DIR = path.join(process.cwd(), "app", "api");

/**
 * Bewusst offen: der Health-Endpunkt fuer den Container-Betrieb, die Wege
 * in die Anmeldung hinein (die es ohne Sitzung gar nicht gaebe) und das
 * Abmelden, das auch mit einer laengst ungueltigen Sitzung noch aufraeumen
 * koennen muss.
 *
 * Die Ersteinrichtung (req-037) kann keine Sitzung verlangen -- es gibt noch
 * niemanden, der eine haette. Sie prueft stattdessen, dass die Installation
 * wirklich leer ist; genau das verlangt der Test darunter.
 */
const OHNE_ANMELDUNG = [
  "health/route.ts",
  "auth/anmeldelink/route.ts",
  "auth/notfallcode/route.ts",
  "auth/passkey/anmeldung/route.ts",
  "auth/abmelden/route.ts",
  "auth/ersteinrichtung/route.ts",
];

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findRouteFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

const routeFiles = findRouteFiles(API_DIR).map((file) =>
  path.relative(API_DIR, file).split(path.sep).join("/"),
);

describe("Schnittstellen unter app/api", () => {
  it("werden von diesem Test tatsaechlich erfasst", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    for (const exempt of OHNE_ANMELDUNG) {
      expect(routeFiles).toContain(exempt);
    }
  });

  it.each(routeFiles.filter((file) => !OHNE_ANMELDUNG.includes(file)))(
    "%s prueft die Sitzung selbst (req-016)",
    (file) => {
      const source = readFileSync(path.join(API_DIR, file), "utf8");

      expect(source).toContain("currentSession(");
    },
  );

  // req-037: der einzige Weg ohne Sitzung, der Daten anlegt. Er darf nur
  // existieren, solange die Installation keinen einzigen Teilnehmer kennt --
  // geprueft in GET und POST, nicht nur in der Anzeige.
  it("laesst die Ersteinrichtung nur bei leerer Installation zu (req-037)", () => {
    const source = readFileSync(
      path.join(API_DIR, "auth/ersteinrichtung/route.ts"),
      "utf8",
    );

    expect(source.match(/bootstrapAvailable\(/g)?.length ?? 0).toBeGreaterThan(
      1,
    );
  });
});
