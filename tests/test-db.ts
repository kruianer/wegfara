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
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .filter(enthaeltAnweisung);
}

/**
 * Ob in einer Migration ueberhaupt etwas steht, das auszufuehren waere.
 * Seit req-064 gibt es Migrationen, die nur noch aus Kommentaren bestehen:
 * ihre Daten wurden gestrichen, die Datei bleibt aber mit ihrer Nummer
 * stehen. PostgreSQL nimmt so etwas als leere Anfrage hin, das Test-Double
 * (pg-mem) bricht daran ab -- deshalb werden sie hier uebersprungen.
 */
function enthaeltAnweisung(sql: string): boolean {
  return sql.replace(/--[^\n]*/g, "").trim().length > 0;
}

/**
 * Die Demo-Daten aus seed/demo-daten.sql (req-064). Sie kamen bis dahin aus
 * den Migrationen; seit req-064 legt eine frische Umgebung sie nicht mehr an,
 * und wer sie will, spielt sie ausdruecklich ein. Fuer die Tests tut das
 * createTestDb() -- sie arbeiten damit weiter auf demselben Bestand.
 */
function seedSource(): string {
  return readFileSync(
    path.join(process.cwd(), "seed", "demo-daten.sql"),
    "utf8",
  );
}

/**
 * Spielt die Demo-Daten in eine bereits migrierte Datenbank ein -- dasselbe,
 * was `npm run seed:demo` in einer frischen dev-Umgebung tut (req-064).
 */
export async function seedDemoData(pool: { query: PoolQuery }): Promise<void> {
  await pool.query(seedSource());
}

type PoolQuery = (sql: string) => Promise<unknown>;

export function createTestDb() {
  const db = newDb();
  for (const sql of migrationSources()) {
    db.public.none(sql);
  }
  db.public.none(seedSource());
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

/**
 * Nur das Schema, ohne die Demo-Daten: so sieht eine frisch aufgebaute
 * Umgebung aus, in der niemand das Befuellen angestossen hat (req-064). Der
 * Account und der Betreiber sind darin enthalten -- sie kommen aus den
 * Migrationen und sind kein Demo-Datum.
 */
export function createMigratedTestDb() {
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
 *
 * Eine spaeter wieder entfernte Tabelle steht zwar in den Migrationen, aber
 * nicht mehr im Schema (siehe migrations/0033_gastzugang_entfernen.sql) --
 * sie wird hier ebenso aus den Migrationen heraus abgezogen.
 */
export async function createEmptyTestDb() {
  const pool = createMigratedTestDb();
  const sources = migrationSources();
  const entfernt = new Set(
    sources.flatMap((sql) =>
      [...sql.matchAll(/drop table (?:if exists )?(\w+)/g)].map(
        (match) => match[1],
      ),
    ),
  );
  let offen = sources
    .flatMap((sql) =>
      [...sql.matchAll(/create table (\w+)/g)].map((match) => match[1]),
    )
    .filter((table) => !entfernt.has(table));

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
 * aus seed/demo-daten.sql haengen. Seit req-024
 * kennt der Quelltext keine feste Account-Kennung mehr -- in wessen Account
 * gearbeitet wird, ergibt sich aus der Anmeldung. Tests brauchen die Kennung
 * trotzdem, um die vorhandenen Demodaten zu adressieren.
 */
export const ACCOUNT_ID = "eb873b95-257b-49c6-b08f-1709d6ad3b94";
