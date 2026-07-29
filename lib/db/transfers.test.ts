// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { listTransfers } from "./transfers";
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

describe("listTransfers", () => {
  it("liefert die Transfers des Accounts (req-006)", async () => {
    const pool = createTestDb();

    const transfers = await listTransfers(pool, ACCOUNT_ID);

    expect(transfers.length).toBeGreaterThan(0);
    const zumAussichtspunkt = transfers.find(
      (t) => t.title === "Fahrt zum Aussichtspunkt",
    );
    expect(zumAussichtspunkt).toMatchObject({
      tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
      fromActivityId: "384d0b94-df7f-44b3-8bcf-013b41a6d265",
      toActivityId: "deaacefe-9cc1-4835-9be5-5b23a231720c",
      mode: "auto",
      durationMin: 12,
      distanceKm: 4.2,
    });
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const otherAccountId = randomUUID();
    const otherTripId = randomUUID();
    const activityAId = randomUUID();
    const activityBId = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [otherAccountId, "Andere Person", "andere@example.com"],
    );
    await pool.query(
      `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
       values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
      [otherTripId, otherAccountId],
    );
    await pool.query(
      `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt A', 'kurz', 'lang', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [activityAId, otherTripId],
    );
    await pool.query(
      `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt B', 'kurz', 'lang', '2027-01-01 12:00', '2027-01-01 13:00', 52.52, 13.405)`,
      [activityBId, otherTripId],
    );
    await pool.query(
      `insert into transfer (id, trip_id, from_activity_id, to_activity_id, mode, title, duration_min, distance_km)
       values ($1, $2, $3, $4, 'auto', 'Fremder Transfer', 10, 2)`,
      [randomUUID(), otherTripId, activityAId, activityBId],
    );

    const transfers = await listTransfers(pool, ACCOUNT_ID);

    expect(transfers.some((t) => t.title === "Fremder Transfer")).toBe(false);
  });
});
