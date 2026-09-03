import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";

/**
 * Eine Datenbank im Arbeitsspeicher mit allen Migrationen des Repos --
 * damit laufen Tests gegen dasselbe Schema wie die Anwendung, ohne dass
 * eine PostgreSQL-Instanz laufen muss.
 */
export function createTestDb() {
  const db = newDb();
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.public.none(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  const { Pool } = db.adapters.createPg();
  return new Pool();
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
