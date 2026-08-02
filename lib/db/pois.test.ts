// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { listPois, setPoiStatus } from "./pois";
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

describe("listPois", () => {
  it("liefert zwoelf POIs fuer die Suditalien Rundreise", async () => {
    const pool = createTestDb();

    const pois = await listPois(pool, ACCOUNT_ID);

    const suditalien = pois.filter(
      (p) => p.tripId === "d5fda5ea-65e7-4b47-8096-62618599a288",
    );
    expect(suditalien).toHaveLength(12);
  });

  it("liefert Name, Ort, Typ, Position, Status und Webadresse eines POI", async () => {
    const pool = createTestDb();

    const pois = await listPois(pool, ACCOUNT_ID);

    const pompeji = pois.find((p) => p.name === "Ausgrabungsstätte Pompeji");
    expect(pompeji).toMatchObject({
      ort: "Pompei",
      type: "sehenswuerdigkeit",
      position: { lat: 40.7489, lng: 14.4989 },
      status: "gesetzt",
      web: "https://pompeiisites.org",
    });
  });

  it("liefert keine Webadresse, wenn keine hinterlegt ist", async () => {
    const pool = createTestDb();

    const pois = await listPois(pool, ACCOUNT_ID);

    const nennella = pois.find((p) => p.name === "Trattoria da Nennella");
    expect(nennella?.web).toBeUndefined();
  });

  it("liefert POIs zu jeder der drei Reisen", async () => {
    const pool = createTestDb();

    const pois = await listPois(pool, ACCOUNT_ID);

    const tripIds = new Set(pois.map((p) => p.tripId));
    expect(tripIds).toEqual(
      new Set([
        "d5fda5ea-65e7-4b47-8096-62618599a288",
        "4b5f95d6-5ad3-4049-b71c-0b90fef8e950",
        "72d68515-6bb1-4723-95d9-2a04fb65e5ca",
      ]),
    );
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
    await pool.query(
      `insert into poi (id, trip_id, name, ort, type, lat, lng, status)
       values ($1, $2, 'Fremder POI', 'Berlin', 'sehenswuerdigkeit', 52.52, 13.405, 'weiss_nicht')`,
      [randomUUID(), otherTripId],
    );

    const pois = await listPois(pool, ACCOUNT_ID);

    expect(pois.some((p) => p.name === "Fremder POI")).toBe(false);
  });
});

describe("setPoiStatus", () => {
  it("aktualisiert den Status eines POI dauerhaft", async () => {
    const pool = createTestDb();
    const before = await listPois(pool, ACCOUNT_ID);
    const ravello = before.find((p) => p.name === "Villa Rufolo")!;
    expect(ravello.status).toBe("weiss_nicht");

    await setPoiStatus(pool, ravello.id, "gesetzt");

    const after = await listPois(pool, ACCOUNT_ID);
    expect(after.find((p) => p.id === ravello.id)?.status).toBe("gesetzt");
  });
});
