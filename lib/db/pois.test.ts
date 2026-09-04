// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import {
  createPoi,
  createPois,
  deletePoi,
  listPois,
  savePoiFromGoogle,
  setPoiStatus,
  updatePoi,
  type PoiFromGoogle,
} from "./pois";
import { replacePoiPhotos } from "./poi-photos";
import type { Poi, PoiValues } from "@/lib/pois/types";
import { ACCOUNT_ID } from "@/tests/test-db";

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

/** Ein zweiter Mandant mit eigener Reise und eigenem POI. */
async function fremderAccountMitPoi(
  pool: ReturnType<typeof createTestDb>,
): Promise<{ accountId: string; tripId: string; poiId: string }> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const poiId = randomUUID();
  await pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  await pool.query(
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status)
     values ($1, $2, 1, 'Fremder POI', 'Berlin', 'sehenswuerdigkeit', 52.52, 13.405, 'weiss_nicht')`,
    [poiId, tripId],
  );
  return { accountId, tripId, poiId };
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
    await fremderAccountMitPoi(pool);

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

    await setPoiStatus(pool, ACCOUNT_ID, ravello.id, "gesetzt");

    const after = await listPois(pool, ACCOUNT_ID);
    expect(after.find((p) => p.id === ravello.id)?.status).toBe("gesetzt");
  });

  it("aendert keinen POI eines anderen Accounts (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitPoi(pool);

    const gesetzt = await setPoiStatus(
      pool,
      ACCOUNT_ID,
      fremd.poiId,
      "gesetzt",
    );

    expect(gesetzt).toBe(false);
    const { rows } = await pool.query(`select status from poi where id = $1`, [
      fremd.poiId,
    ]);
    expect((rows[0] as { status: string }).status).toBe("weiss_nicht");
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

describe("savePoiFromGoogle (req-026)", () => {
  const SUDITALIEN_TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

  function villaRufolo(overrides: Partial<PoiFromGoogle> = {}): PoiFromGoogle {
    return {
      googlePlaceId: "ChIJVillaRufolo",
      name: "Villa Rufolo",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      web: "https://villarufolo.com",
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      phone: "+39 089 857621",
      openingHours: ["Montag: 09:00–20:00", "Dienstag: 09:00–20:00"],
      ...overrides,
    };
  }

  it("legt einen neuen POI mit allen uebernommenen Angaben an", async () => {
    const pool = createTestDb();

    const gespeichert = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo({ name: "Villa Cimbrone", googlePlaceId: "ChIJCimbrone" }),
    );

    expect(gespeichert?.created).toBe(true);
    expect(gespeichert?.poi).toMatchObject({
      name: "Villa Cimbrone",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      status: "weiss_nicht",
      web: "https://villarufolo.com",
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      phone: "+39 089 857621",
      openingHours: ["Montag: 09:00–20:00", "Dienstag: 09:00–20:00"],
      googlePlaceId: "ChIJCimbrone",
    });
  });

  it("gibt einem neuen POI die naechste freie Nummer der Reise", async () => {
    const pool = createTestDb();
    const vorher = await listPois(pool, ACCOUNT_ID);
    const maxNumber = Math.max(
      ...vorher
        .filter((p) => p.tripId === SUDITALIEN_TRIP_ID)
        .map((p) => p.number),
    );

    const gespeichert = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo({ name: "Villa Cimbrone", googlePlaceId: "ChIJCimbrone" }),
    );

    expect(gespeichert?.poi.number).toBe(maxNumber + 1);
  });

  it("legt denselben Ort kein zweites Mal an", async () => {
    const pool = createTestDb();
    await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo(),
    );

    const zweiter = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo(),
    );

    expect(zweiter?.created).toBe(false);
    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.filter((p) => p.name === "Villa Rufolo")).toHaveLength(1);
  });

  it("erhaelt beim Auffrischen Nummer und Status", async () => {
    const pool = createTestDb();
    const vorher = await listPois(pool, ACCOUNT_ID);
    // Der Demo-POI "Villa Rufolo" der Suditalien-Rundreise, von Hand
    // angelegt und damit ohne Kennung bei Google.
    const bestehend = vorher.find((p) => p.name === "Villa Rufolo")!;
    await setPoiStatus(pool, ACCOUNT_ID, bestehend.id, "gesetzt");

    const gespeichert = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo(),
    );

    expect(gespeichert).toMatchObject({
      created: false,
      poi: {
        id: bestehend.id,
        number: bestehend.number,
        status: "gesetzt",
      },
    });
  });

  it("frischt die Angaben eines bestehenden POI auf", async () => {
    const pool = createTestDb();

    await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo(),
    );

    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.find((p) => p.name === "Villa Rufolo")).toMatchObject({
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      phone: "+39 089 857621",
      googlePlaceId: "ChIJVillaRufolo",
    });
  });

  it("erkennt denselben Ort an seiner Kennung, auch wenn Google ihn umbenennt", async () => {
    const pool = createTestDb();
    await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo({ name: "Villa Cimbrone", googlePlaceId: "ChIJCimbrone" }),
    );

    const zweiter = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo({
        name: "Villa Cimbrone Gärten",
        googlePlaceId: "ChIJCimbrone",
      }),
    );

    expect(zweiter?.created).toBe(false);
    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.filter((p) => p.googlePlaceId === "ChIJCimbrone")).toHaveLength(
      1,
    );
  });

  it("legt denselben Ort in einer anderen Reise sehr wohl an", async () => {
    const pool = createTestDb();
    const WIEN_TRIP_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";
    await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaRufolo(),
    );

    const zweiter = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      WIEN_TRIP_ID,
      villaRufolo(),
    );

    expect(zweiter?.created).toBe(true);
  });

  it("legt keinen POI in einer Reise eines anderen Accounts an (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitPoi(pool);

    const gespeichert = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      fremd.tripId,
      villaRufolo(),
    );

    expect(gespeichert).toBeNull();
    const { rows } = await pool.query(`select id from poi where trip_id = $1`, [
      fremd.tripId,
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("createPoi (req-035)", () => {
  const SUDITALIEN_TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

  function bucht(overrides: Partial<PoiValues> = {}): PoiValues {
    return {
      name: "Bucht bei Praiano",
      ort: "Praiano",
      type: "strand",
      position: { lat: 40.6117, lng: 14.5289 },
      status: "weiss_nicht",
      web: null,
      address: null,
      phone: null,
      openingHours: null,
      ...overrides,
    };
  }

  it("legt einen POI von Hand an", async () => {
    const pool = createTestDb();

    const angelegt = await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      bucht(),
    );

    expect(angelegt).toMatchObject({
      name: "Bucht bei Praiano",
      ort: "Praiano",
      type: "strand",
      position: { lat: 40.6117, lng: 14.5289 },
      status: "weiss_nicht",
    });
    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.some((p) => p.name === "Bucht bei Praiano")).toBe(true);
  });

  it("legt den POI ohne abgeleiteten Ort ohne Ortsangabe an (req-041)", async () => {
    const pool = createTestDb();

    const angelegt = await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      bucht({ ort: null }),
    );

    expect(angelegt?.ort).toBe("");
  });

  it("gibt dem neuen POI die naechste freie Nummer (req-013)", async () => {
    const pool = createTestDb();
    const vorher = await listPois(pool, ACCOUNT_ID);
    const maxNumber = Math.max(
      ...vorher
        .filter((p) => p.tripId === SUDITALIEN_TRIP_ID)
        .map((p) => p.number),
    );

    const angelegt = await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      bucht(),
    );

    expect(angelegt?.number).toBe(maxNumber + 1);
  });

  it("legt keinen POI in einer Reise eines anderen Accounts an (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitPoi(pool);

    const angelegt = await createPoi(pool, ACCOUNT_ID, fremd.tripId, bucht());

    expect(angelegt).toBeNull();
    const { rows } = await pool.query(`select id from poi where trip_id = $1`, [
      fremd.tripId,
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("updatePoi (req-035)", () => {
  function ausPoi(poi: Poi, overrides: Partial<PoiValues> = {}): PoiValues {
    return {
      name: poi.name,
      ort: poi.ort,
      type: poi.type,
      position: poi.position,
      status: poi.status,
      web: poi.web ?? null,
      address: poi.address ?? null,
      phone: poi.phone ?? null,
      openingHours: poi.openingHours ?? null,
      ...overrides,
    };
  }

  it("aendert die Angaben eines POI", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, {
        name: "Villa Rufolo (Garten)",
        phone: "+39 089 857621",
        status: "gesetzt",
      }),
    );

    expect(geaendert).toMatchObject({
      name: "Villa Rufolo (Garten)",
      phone: "+39 089 857621",
      status: "gesetzt",
    });
    const danach = await listPois(pool, ACCOUNT_ID);
    expect(danach.find((p) => p.id === villa.id)?.name).toBe(
      "Villa Rufolo (Garten)",
    );
  });

  it("laesst den gespeicherten Ort stehen, wenn keiner abgeleitet wurde (req-041)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, { name: "Villa Rufolo (Garten)", ort: null }),
    );

    expect(geaendert?.ort).toBe("Ravello");
  });

  it("vermerkt einen neu abgeleiteten Ort nicht als von Hand geaendert (req-041)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, { ort: "Amalfi" }),
    );

    const { rows } = await pool.query(
      `select ort, manual_fields from poi where id = $1`,
      [villa.id],
    );
    expect(rows[0]).toMatchObject({ ort: "Amalfi", manual_fields: "" });
  });

  it("laesst die Nummer unveraendert (req-013)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, { name: "Villa Rufolo (Garten)" }),
    );

    expect(geaendert?.number).toBe(villa.number);
  });

  it("vermerkt nur die tatsaechlich geaenderten Angaben als von Hand geaendert", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, { name: "Villa Rufolo (Garten)" }),
    );

    const { rows } = await pool.query(
      `select manual_fields from poi where id = $1`,
      [villa.id],
    );
    expect((rows[0] as { manual_fields: string }).manual_fields).toBe("name");
  });

  it("aendert keinen POI eines anderen Accounts (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitPoi(pool);
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      fremd.poiId,
      ausPoi(villa, { name: "Gekapert" }),
    );

    expect(geaendert).toBeNull();
    const { rows } = await pool.query(`select name from poi where id = $1`, [
      fremd.poiId,
    ]);
    expect((rows[0] as { name: string }).name).toBe("Fremder POI");
  });

  it("laesst einen von Hand geaenderten Namen beim naechsten Google-Import stehen", async () => {
    const pool = createTestDb();
    const ausGoogle: PoiFromGoogle = {
      googlePlaceId: "ChIJVillaCimbrone",
      name: "Villa Cimbrone",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6465, lng: 14.6127 },
      address: "Via Santa Chiara, 26, 84010 Ravello SA, Italien",
    };
    const tripId = "d5fda5ea-65e7-4b47-8096-62618599a288";
    const importiert = (await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      tripId,
      ausGoogle,
    ))!.poi;
    await updatePoi(
      pool,
      ACCOUNT_ID,
      importiert.id,
      ausPoi(importiert, {
        name: "Villa Cimbrone (Garten)",
        address: null,
      }),
    );

    const aufgefrischt = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      tripId,
      ausGoogle,
    );

    // Der Name bleibt meiner; unberuehrte Felder nehmen den Stand von Google
    // an -- nur eben nicht die Adresse, die ich selbst geleert habe.
    expect(aufgefrischt?.created).toBe(false);
    expect(aufgefrischt?.poi.name).toBe("Villa Cimbrone (Garten)");
    expect(aufgefrischt?.poi.address).toBeUndefined();
    expect(aufgefrischt?.poi.ort).toBe("Ravello");
  });

  it("laesst beim Google-Import den gespeicherten Ort stehen, wenn keiner abgeleitet wurde (req-041)", async () => {
    const pool = createTestDb();
    const tripId = "d5fda5ea-65e7-4b47-8096-62618599a288";
    const ausGoogle: PoiFromGoogle = {
      googlePlaceId: "ChIJVillaCimbrone",
      name: "Villa Cimbrone",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6465, lng: 14.6127 },
    };
    await savePoiFromGoogle(pool, ACCOUNT_ID, tripId, ausGoogle);

    const aufgefrischt = await savePoiFromGoogle(pool, ACCOUNT_ID, tripId, {
      ...ausGoogle,
      ort: null,
    });

    expect(aufgefrischt?.poi.ort).toBe("Ravello");
  });

  it("legt einen neuen POI aus Google ohne abgeleiteten Ort ohne Ortsangabe an (req-041)", async () => {
    const pool = createTestDb();

    const angelegt = await savePoiFromGoogle(
      pool,
      ACCOUNT_ID,
      "d5fda5ea-65e7-4b47-8096-62618599a288",
      {
        googlePlaceId: "ChIJVillaCimbrone",
        name: "Villa Cimbrone",
        ort: null,
        type: "sehenswuerdigkeit",
        position: { lat: 40.6465, lng: 14.6127 },
      },
    );

    expect(angelegt?.created).toBe(true);
    expect(angelegt?.poi.ort).toBe("");
  });
});

describe("deletePoi (req-035)", () => {
  it("entfernt den POI aus der Reise", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    const entfernt = await deletePoi(pool, ACCOUNT_ID, villa.id);

    expect(entfernt?.poi.name).toBe("Villa Rufolo");
    const danach = await listPois(pool, ACCOUNT_ID);
    expect(danach.some((p) => p.id === villa.id)).toBe(false);
  });

  it("meldet die Dateinamen seiner Fotos zum Raeumen", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;
    await replacePoiPhotos(pool, villa.id, ["a.jpg", "b.jpg"], new Date());

    const entfernt = await deletePoi(pool, ACCOUNT_ID, villa.id);

    expect(entfernt?.removedFileNames).toEqual(["a.jpg", "b.jpg"]);
    const { rows } = await pool.query(
      `select id from poi_photo where poi_id = $1`,
      [villa.id],
    );
    expect(rows).toHaveLength(0);
  });

  it("laesst einen zugeordneten Programmpunkt bestehen und loest nur die Verknuepfung", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;
    const { rows: vorher } = await pool.query(
      `select id from activity where poi_id = $1`,
      [villa.id],
    );
    expect(vorher.length).toBeGreaterThan(0);
    const activityId = (vorher[0] as { id: string }).id;

    await deletePoi(pool, ACCOUNT_ID, villa.id);

    const { rows } = await pool.query(
      `select id, poi_id from activity where id = $1`,
      [activityId],
    );
    expect(rows).toHaveLength(1);
    expect((rows[0] as { poi_id: string | null }).poi_id).toBeNull();
  });

  it("entfernt keinen POI eines anderen Accounts (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitPoi(pool);

    const entfernt = await deletePoi(pool, ACCOUNT_ID, fremd.poiId);

    expect(entfernt).toBeNull();
    const { rows } = await pool.query(`select id from poi where id = $1`, [
      fremd.poiId,
    ]);
    expect(rows).toHaveLength(1);
  });
});
