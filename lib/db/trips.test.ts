// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { listTrips } from "./trips";
import { ACCOUNT_ID } from "../account";

function createTestDb() {
  const db = newDb();
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.public.none(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

describe("listTrips", () => {
  it("liefert die Reisen des Accounts, sortiert nach Startdatum", async () => {
    const pool = createTestDb();

    const trips = await listTrips(pool, ACCOUNT_ID);

    expect(trips.map((t) => t.title)).toEqual([
      "Alpen-Adria-Radtour",
      "Süditalien Rundreise",
      "Wien Städtereise",
    ]);
    const suedItalien = trips.find((t) => t.title === "Süditalien Rundreise");
    expect(suedItalien).toMatchObject({
      startDate: "2026-07-18",
      endDate: "2026-07-23",
      mainPlace: { name: "Amalfi" },
    });
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const otherAccountId = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [otherAccountId, "Andere Person", "andere@example.com"],
    );
    await pool.query(
      `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
       values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
      [randomUUID(), otherAccountId],
    );

    const trips = await listTrips(pool, ACCOUNT_ID);

    expect(trips.some((t) => t.title === "Fremde Reise")).toBe(false);
  });
});
