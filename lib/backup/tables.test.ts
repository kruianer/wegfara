// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/test-db";
import { BACKUP_TABLES, EXCLUDED_TABLES } from "./tables";

/**
 * Die Reihenfolge in BACKUP_TABLES steht von Hand im Quelltext -- sie ergibt
 * sich aus den Fremdschluesseln. Diese Pruefung haelt sie aktuell: eine neue
 * Tabelle aus einer Migration ohne Eintrag dort macht diesen Test rot, und
 * ein Backup ohne sie waere unvollstaendig (req-053).
 */
async function tabellenDesSchemas(): Promise<string[]> {
  const pool = createTestDb();
  const { rows } = await pool.query(
    `select table_name from information_schema.tables
      where table_schema = 'public'
      order by table_name`,
  );
  return (rows as { table_name: string }[]).map((row) => row.table_name);
}

describe("BACKUP_TABLES (req-053)", () => {
  it("deckt jede Tabelle des Schemas ab", async () => {
    const schema = await tabellenDesSchemas();
    const abgedeckt = new Set([...BACKUP_TABLES, ...EXCLUDED_TABLES]);

    expect(schema.filter((table) => !abgedeckt.has(table))).toEqual([]);
  });

  it("nennt keine Tabelle, die es nicht gibt", async () => {
    const schema = new Set(await tabellenDesSchemas());

    expect(BACKUP_TABLES.filter((table) => !schema.has(table))).toEqual([]);
  });

  it("nennt keine Tabelle zweimal", () => {
    expect(new Set(BACKUP_TABLES).size).toBe(BACKUP_TABLES.length);
  });

  it("laesst den Stand der Migrationen bewusst aus", () => {
    expect(EXCLUDED_TABLES).toContain("schema_migrations");
    expect(BACKUP_TABLES).not.toContain("schema_migrations");
  });
});
