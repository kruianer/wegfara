// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import {
  listActivityOptionSelections,
  setActivityOptionSelection,
} from "./activity-option-selections";
import { ACCOUNT_ID } from "@/tests/test-db";

const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const GROUP_START = "2026-07-21T13:30";
const GROUP_END = "2026-07-21T15:00";
const HERCULANEUM_ID = "1a2b3c4d-0001-4a11-8b11-9f1c2d3e4f01";
const VESUV_ID = "1a2b3c4d-0002-4a11-8b11-9f1c2d3e4f02";

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

describe("setActivityOptionSelection / listActivityOptionSelections", () => {
  it("liefert keine Wahl, solange nie gewaehlt wurde", async () => {
    const pool = createTestDb();

    const selections = await listActivityOptionSelections(pool, ACCOUNT_ID);

    expect(
      selections[`${TRIP_ID}|${GROUP_START}|${GROUP_END}`],
    ).toBeUndefined();
  });

  it("speichert eine Wahl und liefert sie danach zurueck", async () => {
    const pool = createTestDb();

    await setActivityOptionSelection(
      pool,
      ACCOUNT_ID,
      TRIP_ID,
      GROUP_START,
      GROUP_END,
      VESUV_ID,
    );
    const selections = await listActivityOptionSelections(pool, ACCOUNT_ID);

    expect(selections[`${TRIP_ID}|${GROUP_START}|${GROUP_END}`]).toEqual(
      VESUV_ID,
    );
  });

  it("ueberschreibt eine bestehende Wahl derselben Gruppe", async () => {
    const pool = createTestDb();

    await setActivityOptionSelection(
      pool,
      ACCOUNT_ID,
      TRIP_ID,
      GROUP_START,
      GROUP_END,
      HERCULANEUM_ID,
    );
    await setActivityOptionSelection(
      pool,
      ACCOUNT_ID,
      TRIP_ID,
      GROUP_START,
      GROUP_END,
      VESUV_ID,
    );
    const selections = await listActivityOptionSelections(pool, ACCOUNT_ID);

    expect(selections[`${TRIP_ID}|${GROUP_START}|${GROUP_END}`]).toEqual(
      VESUV_ID,
    );
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const otherAccountId = randomUUID();
    const otherTripId = randomUUID();
    const otherActivityId = randomUUID();
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
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt', 'kurz', 'lang', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [otherActivityId, otherTripId],
    );
    await setActivityOptionSelection(
      pool,
      otherAccountId,
      otherTripId,
      "2027-01-01T10:00",
      "2027-01-01T11:00",
      otherActivityId,
    );

    const selections = await listActivityOptionSelections(pool, ACCOUNT_ID);

    expect(
      selections[`${otherTripId}|2027-01-01T10:00|2027-01-01T11:00`],
    ).toBeUndefined();
  });

  it("waehlt nichts in einer Reise eines anderen Accounts (req-024)", async () => {
    const pool = createTestDb();
    const otherAccountId = randomUUID();
    const otherTripId = randomUUID();
    const otherActivityId = randomUUID();
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
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt', 'kurz', 'lang', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [otherActivityId, otherTripId],
    );

    const gespeichert = await setActivityOptionSelection(
      pool,
      ACCOUNT_ID,
      otherTripId,
      "2027-01-01T10:00",
      "2027-01-01T11:00",
      otherActivityId,
    );

    expect(gespeichert).toBe(false);
    const selections = await listActivityOptionSelections(pool, otherAccountId);
    expect(selections).toEqual({});
  });
});
