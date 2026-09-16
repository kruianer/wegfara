// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import type { Pool } from "pg";
import {
  createMigratedTestDb,
  PARTICIPANT_EMAIL,
  seedDemoData,
} from "@/tests/test-db";

/**
 * Eine frisch aufgebaute Umgebung ist leer (req-064). Die Migrationen legen
 * keine Reisedaten mehr an -- weder Reisen noch POIs, Programmpunkte oder
 * Transfers. Wer die Demo-Daten will, spielt sie ausdruecklich ein
 * (`npm run seed:demo`, siehe seed/demo-daten.sql).
 *
 * Was bleibt, ist der Zugang zur App: der Account und der Betreiber. Ohne
 * sie waere eine frische Umgebung nicht benutzbar.
 */
describe("frisch eingespielte Migrationen", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = createMigratedTestDb();
  });

  afterEach(async () => {
    await pool.end();
  });

  async function anzahl(tabelle: string): Promise<number> {
    const { rows } = await pool.query(
      `select count(*)::int as n from ${tabelle}`,
    );
    return rows[0].n;
  }

  it("legt keine Reisen an", async () => {
    expect(await anzahl("trip")).toBe(0);
  });

  it("legt keine POIs an", async () => {
    expect(await anzahl("poi")).toBe(0);
  });

  it("legt keine Programmpunkte an", async () => {
    expect(await anzahl("activity")).toBe(0);
  });

  it("legt keine Transfers an", async () => {
    expect(await anzahl("transfer")).toBe(0);
  });

  it("legt genau einen Account an", async () => {
    expect(await anzahl("account")).toBe(1);
  });

  it("legt genau einen Teilnehmer an, den Betreiber", async () => {
    const { rows } = await pool.query("select email from participant");
    expect(rows.map((row) => row.email)).toEqual([PARTICIPANT_EMAIL]);
  });
});

/**
 * Das Kommando zum Befuellen (req-064): `npm run seed:demo` spielt
 * seed/demo-daten.sql ein. Es laeuft nur auf Zuruf -- weder der Start der
 * Anwendung noch ein Deploy ruft es auf.
 */
describe("npm run seed:demo", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = createMigratedTestDb();
  });

  afterEach(async () => {
    await pool.end();
  });

  async function reisen(): Promise<string[]> {
    const { rows } = await pool.query("select title from trip order by title");
    return rows.map((row) => row.title);
  }

  it("stellt die drei Reisen in die frische Umgebung", async () => {
    await seedDemoData(pool);

    expect(await reisen()).toEqual([
      "Alpen-Adria-Radtour",
      "Süditalien Rundreise",
      "Wien Städtereise",
    ]);
  });

  it("laesst eine Umgebung, die die Daten schon hat, unveraendert", async () => {
    await seedDemoData(pool);
    await seedDemoData(pool);

    expect(await reisen()).toHaveLength(3);
    const { rows } = await pool.query("select count(*)::int as n from poi");
    expect(rows[0].n).toBe(20);
  });

  it("ist als Kommando hinterlegt und ruft das Skript auf", () => {
    const paket = JSON.parse(readFileSync("package.json", "utf8"));

    expect(paket.scripts["seed:demo"]).toBe("node scripts/seed-demo.mjs");
  });

  it("laeuft nie von selbst an", () => {
    const paket = JSON.parse(readFileSync("package.json", "utf8"));
    const vonSelbst = Object.entries(paket.scripts as Record<string, string>)
      .filter(([name]) => name !== "seed:demo")
      .filter(([, kommando]) => kommando.includes("seed-demo"));
    expect(vonSelbst).toEqual([]);

    // Der Container migriert beim Start und startet die Anwendung -- mehr
    // nicht (siehe deploy/Dockerfile, deploy/docker-entrypoint.sh).
    expect(readFileSync("deploy/Dockerfile", "utf8")).not.toMatch(
      /(CMD|ENTRYPOINT|RUN)[^\n]*seed-demo/,
    );
    expect(readFileSync("deploy/docker-entrypoint.sh", "utf8")).not.toContain(
      "seed-demo",
    );
    for (const workflow of readdirSync(".github/workflows")) {
      const inhalt = readFileSync(
        path.join(".github/workflows", workflow),
        "utf8",
      );
      expect(inhalt).not.toContain("seed-demo");
      expect(inhalt).not.toContain("seed:demo");
    }
  });

  it("verweigert den Dienst auf prod", () => {
    const lauf = spawnSync(process.execPath, ["scripts/seed-demo.mjs"], {
      env: {
        ...process.env,
        APP_URL: "https://app.wegfara.com",
        DATABASE_URL: "postgres://niemand@127.0.0.1:1/existiert-nicht",
      },
      encoding: "utf8",
    });

    expect(lauf.status).toBe(1);
    expect(lauf.stderr).toContain("prod");
  });
});
