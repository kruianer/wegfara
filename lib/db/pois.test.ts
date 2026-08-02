// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { createPois, listPois, setPoiStatus } from "./pois";
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

  it("nummeriert die POIs einer Reise fortlaufend beginnend bei 1", async () => {
    const pool = createTestDb();

    const pois = await listPois(pool, ACCOUNT_ID);

    const suditalien = pois.filter(
      (p) => p.tripId === "d5fda5ea-65e7-4b47-8096-62618599a288",
    );
    expect(new Set(suditalien.map((p) => p.number))).toEqual(
      new Set(Array.from({ length: 12 }, (_, i) => i + 1)),
    );
  });

  it("liefert die Nummer eines POI", async () => {
    const pool = createTestDb();

    const pois = await listPois(pool, ACCOUNT_ID);

    const matera = pois.find((p) => p.name === "Sassi di Matera");
    expect(matera?.number).toBe(7);
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
      `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status)
       values ($1, $2, 1, 'Fremder POI', 'Berlin', 'sehenswuerdigkeit', 52.52, 13.405, 'weiss_nicht')`,
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

describe("createPois", () => {
  const SUDITALIEN_TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

  it("legt einen POI mit Status 'Weiß noch nicht' an", async () => {
    const pool = createTestDb();

    const [created] = await createPois(pool, SUDITALIEN_TRIP_ID, [
      {
        name: "Trulli di Alberobello",
        ort: "Alberobello",
        type: "sehenswuerdigkeit",
        position: { lat: 40.78, lng: 17.24 },
      },
    ]);

    expect(created.status).toBe("weiss_nicht");
    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.find((p) => p.id === created.id)).toMatchObject({
      name: "Trulli di Alberobello",
      ort: "Alberobello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.78, lng: 17.24 },
      status: "weiss_nicht",
    });
  });

  it("nummeriert neue POIs fortlaufend ab der naechsten freien Nummer", async () => {
    const pool = createTestDb();
    const before = await listPois(pool, ACCOUNT_ID);
    const maxNumber = Math.max(
      ...before
        .filter((p) => p.tripId === SUDITALIEN_TRIP_ID)
        .map((p) => p.number),
    );

    const created = await createPois(pool, SUDITALIEN_TRIP_ID, [
      {
        name: "Ort A",
        ort: "Ort",
        type: "restaurant",
        position: { lat: 1, lng: 1 },
      },
      {
        name: "Ort B",
        ort: "Ort",
        type: "restaurant",
        position: { lat: 2, lng: 2 },
      },
    ]);

    expect(created.map((p) => p.number)).toEqual([
      maxNumber + 1,
      maxNumber + 2,
    ]);
  });

  it("uebernimmt die Webadresse, wenn angegeben", async () => {
    const pool = createTestDb();

    const [created] = await createPois(pool, SUDITALIEN_TRIP_ID, [
      {
        name: "Museo del Territorio",
        ort: "Alberobello",
        type: "sehenswuerdigkeit",
        position: { lat: 40.78, lng: 17.24 },
        web: "https://example.com",
      },
    ]);

    expect(created.web).toBe("https://example.com");
  });
});
