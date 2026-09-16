// Fuellt eine frische Umgebung mit den Demo-Daten aus seed/demo-daten.sql
// (req-064): dieselben drei Reisen, POIs, Programmpunkte und Transfers, die
// bis req-064 aus den Migrationen kamen.
//
// Laeuft nie von selbst -- weder beim Start noch beim Deploy, sondern
// ausschliesslich auf Zuruf: `npm run seed:demo`. Wer das Kommando nicht
// aufruft, behaelt eine leere Umgebung.
//
// Mehrfaches Ausfuehren ist ungefaehrlich: jede Anweisung der Datei laesst
// Vorhandenes stehen ("on conflict do nothing").
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

/**
 * Die Adresse der prod-Umgebung (siehe delivery/devops.md). Genau dort
 * haben Demo-Daten nichts verloren -- das ist der Anlass von req-064 --,
 * deshalb verweigert das Kommando dort den Dienst.
 */
const PROD_HOST = "app.wegfara.com";

function istProd() {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) return false;
  try {
    return new URL(appUrl).hostname === PROD_HOST;
  } catch {
    return false;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL fehlt -- ohne sie ist nicht klar, welche Umgebung zu fuellen waere.",
    );
  }
  if (istProd()) {
    throw new Error(
      `Diese Umgebung ist prod (APP_URL zeigt auf ${PROD_HOST}). Dorthin gehoeren keine Demo-Daten (req-064).`,
    );
  }

  const datei = path.join(process.cwd(), "seed", "demo-daten.sql");
  const sql = await readFile(datei, "utf8");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }

    const { rows } = await client.query(
      "select title from trip order by start_date",
    );
    console.log(
      `Demo-Daten eingespielt. Reisen in dieser Umgebung: ${rows.length}`,
    );
    for (const row of rows) console.log(`  - ${row.title}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
