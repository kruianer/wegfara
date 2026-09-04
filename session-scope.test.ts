// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createTestDb } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Jeder Zugriff setzt eine angemeldete Person voraus (req-042).
 *
 * Bis req-038 gab es daneben den Gastzugang: einen befristeten Link zu genau
 * einer Reise, dessen Sitzung in einer eigenen Tabelle lag. Mit req-042 ist er
 * restlos entfernt -- die Einladung (req-023) ist wieder der einzige Weg in die
 * App. Diese Datei haelt beides fest: dass vom Gastzugang nichts uebrig ist,
 * und den Aufbau, der ohne ihn traegt -- jede Schnittstelle holt die
 * angemeldete Person aus `currentSession()`.
 */

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { currentSession } = await import("@/lib/auth/current-session");

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("Der Gastzugang ist entfernt (req-042)", () => {
  it.each(["guest_access", "guest_session"])(
    "kennt die Ablage %s nicht mehr",
    async (tabelle) => {
      await expect(
        testDb.pool.query(`select 1 from ${tabelle}`),
      ).rejects.toThrow();
    },
  );

  /**
   * Wer beim Einspielen der Umstellung gerade als Gast zuschaute, hat das
   * Cookie noch im Browser. Es fuehrt nun ins Leere: die Anmeldung findet
   * keine Sitzung, und der naechste Aufruf endet auf der Anmeldeseite.
   */
  it("macht aus einem laufenden Gast-Cookie keine Sitzung", async () => {
    cookieJar.werte[SESSION_COOKIE] = "gast-sitzung-von-vorher";

    expect(await currentSession()).toBeNull();
  });

  /**
   * Der Gastzugang ist nicht ausgeblendet, sondern entfernt: kein Quelltext
   * der Anwendung kennt ihn noch. Geprueft wird gegen die Bezeichner, die es
   * nur bei ihm gab -- nicht gegen "Gast" im Fliesstext, das auch in einem
   * Personennamen oder in einem POI-Typ ("guest_house") steckt.
   *
   * Tests sind ausgenommen: sie halten gerade fest, dass es ihn nicht mehr
   * gibt, und muessen ihn dafuer beim Namen nennen.
   */
  it("kommt in keinem Quelltext mehr vor", () => {
    const verboten = [
      "guest_access",
      "guest_session",
      "currentGuest",
      "GuestSession",
      "guestAccess",
      "gastzugaenge",
      "/lib/guests/",
    ];

    const treffer = quelldateien(["app", "lib", "components"])
      .map((datei) => ({ datei, inhalt: readFileSync(datei, "utf8") }))
      .filter(({ inhalt }) => verboten.some((wort) => inhalt.includes(wort)))
      .map(({ datei }) => path.relative(process.cwd(), datei));

    expect(treffer).toEqual([]);
  });
});

/**
 * Der Aufbau, auf dem der Zugriffsschutz beruht: jede Schnittstelle holt die
 * angemeldete Person aus `currentSession()`. Ohne diese Pruefung koennte eine
 * neue Schnittstelle jedem offenstehen, ohne dass es jemandem auffaellt.
 */
const OHNE_SITZUNGSPRUEFUNG = [
  // Die Schnittstellen der Anmeldung selbst pruefen ihre eigenen
  // Voraussetzungen (siehe middleware.ts).
  "app/api/auth",
  // Der Health-Endpunkt, den der Container-Betrieb braucht.
  "app/api/health",
];

function quelldateien(verzeichnisse: string[]): string[] {
  return verzeichnisse.flatMap((verzeichnis) =>
    dateienUnter(path.join(process.cwd(), verzeichnis)).filter(
      (datei) =>
        (datei.endsWith(".ts") || datei.endsWith(".tsx")) &&
        !datei.endsWith(".test.ts") &&
        !datei.endsWith(".test.tsx"),
    ),
  );
}

function dateienUnter(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? dateienUnter(full) : [full];
  });
}

describe("Jede Schnittstelle prueft die Sitzung (req-038)", () => {
  it("holt die angemeldete Person aus currentSession()", () => {
    const dateien = dateienUnter(path.join(process.cwd(), "app", "api"))
      .filter((datei) => path.basename(datei) === "route.ts")
      .map((datei) => path.relative(process.cwd(), datei));

    expect(dateien.length).toBeGreaterThan(10);

    const ungeschuetzt = dateien.filter((datei) => {
      if (OHNE_SITZUNGSPRUEFUNG.some((praefix) => datei.startsWith(praefix))) {
        return false;
      }
      return !readFileSync(datei, "utf8").includes("currentSession()");
    });

    expect(ungeschuetzt).toEqual([]);
  });
});
