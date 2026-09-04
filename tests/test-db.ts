import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";

/**
 * Eine Datenbank im Arbeitsspeicher mit allen Migrationen des Repos --
 * damit laufen Tests gegen dasselbe Schema wie die Anwendung, ohne dass
 * eine PostgreSQL-Instanz laufen muss.
 */
function migrationSources(): string[] {
  const migrationsDir = path.join(process.cwd(), "migrations");
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"));
}

export function createTestDb() {
  const db = newDb();
  for (const sql of migrationSources()) {
    db.public.none(sql);
  }
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

/**
 * Eine frisch deployte, leere Umgebung (req-037): dasselbe Schema wie in der
 * Anwendung, aber ohne alles, was die Migrationen an Daten mitbringen -- weder
 * den Teilnehmer aus req-016 noch die Demodaten.
 *
 * Die Tabellen kommen aus den Migrationen selbst. Geleert wird in Runden: was
 * an einem Fremdschluessel haengt, kommt in der naechsten dran. Eine von Hand
 * gepflegte Reihenfolge waere bei jeder neuen Tabelle nachzuziehen -- und ein
 * Fremdschluessel entsteht hier auch mal per "alter table" lange nach der
 * Tabelle, auf die er zeigt (siehe migrations/0012_activity_poi_link.sql).
 */
export async function createEmptyTestDb() {
  const pool = createTestDb();
  let offen = migrationSources().flatMap((sql) =>
    [...sql.matchAll(/create table (\w+)/g)].map((match) => match[1]),
  );

  while (offen.length > 0) {
    const gescheitert: string[] = [];
    for (const table of offen) {
      try {
        await pool.query(`delete from ${table}`);
      } catch {
        gescheitert.push(table);
      }
    }
    if (gescheitert.length === offen.length) {
      throw new Error(
        `Diese Tabellen liessen sich nicht leeren: ${gescheitert.join(", ")}`,
      );
    }
    offen = gescheitert;
  }
  return pool;
}

/** Das Konto, das mit migrations/0015_auth.sql angelegt wird. */
export const PARTICIPANT_ID = "5e0cd230-3765-425b-be49-6a95028ba0b8";
export const PARTICIPANT_EMAIL = "uwe@kremmel.org";

/**
 * Der Account aus migrations/0002_seed_demo_data.sql, an dem die Demodaten
 * haengen. Er gehoert zu den Testdaten, nicht zur Anwendung: seit req-024
 * kennt der Quelltext keine feste Account-Kennung mehr -- in wessen Account
 * gearbeitet wird, ergibt sich aus der Anmeldung. Tests brauchen die Kennung
 * trotzdem, um die vorhandenen Demodaten zu adressieren.
 */
export const ACCOUNT_ID = "eb873b95-257b-49c6-b08f-1709d6ad3b94";
