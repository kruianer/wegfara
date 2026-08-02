// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { clearSearchArea, listSearchAreas, setSearchArea } from "./search-area";
import { ACCOUNT_ID } from "../account";

const SUDITALIEN_TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_TRIP_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

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

const SQUARE = [
  { lat: 40.8, lng: 14.2 },
  { lat: 40.8, lng: 14.4 },
  { lat: 41.0, lng: 14.4 },
];

describe("listSearchAreas", () => {
  it("liefert keine Eintraege, wenn noch kein Suchgebiet gezeichnet wurde", async () => {
    const pool = createTestDb();

    const areas = await listSearchAreas(pool, ACCOUNT_ID);

    expect(areas).toEqual([]);
  });

  it("liefert die Eckpunkte eines gespeicherten Suchgebiets in ihrer Reihenfolge", async () => {
    const pool = createTestDb();

    await setSearchArea(pool, SUDITALIEN_TRIP_ID, SQUARE);
    const areas = await listSearchAreas(pool, ACCOUNT_ID);

    expect(areas).toEqual([{ tripId: SUDITALIEN_TRIP_ID, points: SQUARE }]);
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const otherAccountId = randomUUID();
    const otherTripId = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [otherAccountId, "Andere Person", "andere@example.com"],
    );
    await pool.query(
      `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
       values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
      [otherTripId, otherAccountId],
    );
    await setSearchArea(pool, otherTripId, SQUARE);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);

    expect(areas.some((a) => a.tripId === otherTripId)).toBe(false);
  });
});

describe("setSearchArea", () => {
  it("ersetzt ein vorhandenes Suchgebiet der Reise vollstaendig", async () => {
    const pool = createTestDb();
    await setSearchArea(pool, SUDITALIEN_TRIP_ID, SQUARE);

    const replacement = [
      { lat: 1, lng: 1 },
      { lat: 1, lng: 2 },
      { lat: 2, lng: 2 },
      { lat: 2, lng: 1 },
    ];
    await setSearchArea(pool, SUDITALIEN_TRIP_ID, replacement);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);
    expect(areas).toEqual([
      { tripId: SUDITALIEN_TRIP_ID, points: replacement },
    ]);
  });

  it("speichert Suchgebiete unabhaengig je Reise", async () => {
    const pool = createTestDb();
    await setSearchArea(pool, SUDITALIEN_TRIP_ID, SQUARE);
    await setSearchArea(pool, WIEN_TRIP_ID, SQUARE);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);

    expect(areas.map((a) => a.tripId).sort()).toEqual(
      [SUDITALIEN_TRIP_ID, WIEN_TRIP_ID].sort(),
    );
  });
});

describe("clearSearchArea", () => {
  it("entfernt das Suchgebiet einer Reise wieder", async () => {
    const pool = createTestDb();
    await setSearchArea(pool, SUDITALIEN_TRIP_ID, SQUARE);

    await clearSearchArea(pool, SUDITALIEN_TRIP_ID);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);
    expect(areas).toEqual([]);
  });
});
