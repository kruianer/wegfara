// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { clearSearchArea, listSearchAreas, setSearchArea } from "./search-area";
import { ACCOUNT_ID } from "@/tests/test-db";

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

/** Ein zweiter Mandant mit eigener Reise, fuer die Trennungs-Tests. */
async function fremderAccountMitReise(
  pool: ReturnType<typeof createTestDb>,
): Promise<{ accountId: string; tripId: string }> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  await pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  return { accountId, tripId };
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

    await setSearchArea(pool, ACCOUNT_ID, SUDITALIEN_TRIP_ID, SQUARE);
    const areas = await listSearchAreas(pool, ACCOUNT_ID);

    expect(areas).toEqual([{ tripId: SUDITALIEN_TRIP_ID, points: SQUARE }]);
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    await setSearchArea(pool, fremd.accountId, fremd.tripId, SQUARE);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);

    expect(areas.some((a) => a.tripId === fremd.tripId)).toBe(false);
  });
});

describe("setSearchArea", () => {
  it("ersetzt ein vorhandenes Suchgebiet der Reise vollstaendig", async () => {
    const pool = createTestDb();
    await setSearchArea(pool, ACCOUNT_ID, SUDITALIEN_TRIP_ID, SQUARE);

    const replacement = [
      { lat: 1, lng: 1 },
      { lat: 1, lng: 2 },
      { lat: 2, lng: 2 },
      { lat: 2, lng: 1 },
    ];
    await setSearchArea(pool, ACCOUNT_ID, SUDITALIEN_TRIP_ID, replacement);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);
    expect(areas).toEqual([
      { tripId: SUDITALIEN_TRIP_ID, points: replacement },
    ]);
  });

  it("speichert Suchgebiete unabhaengig je Reise", async () => {
    const pool = createTestDb();
    await setSearchArea(pool, ACCOUNT_ID, SUDITALIEN_TRIP_ID, SQUARE);
    await setSearchArea(pool, ACCOUNT_ID, WIEN_TRIP_ID, SQUARE);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);

    expect(areas.map((a) => a.tripId).sort()).toEqual(
      [SUDITALIEN_TRIP_ID, WIEN_TRIP_ID].sort(),
    );
  });

  it("zeichnet kein Suchgebiet in eine Reise eines anderen Accounts (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    const gespeichert = await setSearchArea(
      pool,
      ACCOUNT_ID,
      fremd.tripId,
      SQUARE,
    );

    expect(gespeichert).toBe(false);
    const areas = await listSearchAreas(pool, fremd.accountId);
    expect(areas).toEqual([]);
  });
});

describe("clearSearchArea", () => {
  it("entfernt das Suchgebiet einer Reise wieder", async () => {
    const pool = createTestDb();
    await setSearchArea(pool, ACCOUNT_ID, SUDITALIEN_TRIP_ID, SQUARE);

    await clearSearchArea(pool, ACCOUNT_ID, SUDITALIEN_TRIP_ID);

    const areas = await listSearchAreas(pool, ACCOUNT_ID);
    expect(areas).toEqual([]);
  });

  it("entfernt kein Suchgebiet eines anderen Accounts (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    await setSearchArea(pool, fremd.accountId, fremd.tripId, SQUARE);

    const geloescht = await clearSearchArea(pool, ACCOUNT_ID, fremd.tripId);

    expect(geloescht).toBe(false);
    const areas = await listSearchAreas(pool, fremd.accountId);
    expect(areas).toEqual([{ tripId: fremd.tripId, points: SQUARE }]);
  });
});
