// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createMigratedTestDb, PARTICIPANT_EMAIL } from "@/tests/test-db";

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
