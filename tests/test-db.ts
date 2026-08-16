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
