// Wendet alle Migrationen aus migrations/ an, die noch nicht in
// schema_migrations verzeichnet sind. Laeuft vor dem App-Start (siehe
// deploy/Dockerfile) sowie manuell via `npm run migrate`.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

async function main() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(
      "create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())",
    );

    const { rows } = await client.query("select id from schema_migrations");
    const applied = new Set(rows.map((r) => r.id));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      console.log(`Wende Migration an: ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (id) values ($1)", [
          file,
        ]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
