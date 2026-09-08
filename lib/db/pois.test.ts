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
  deletePois,
  listPois,
  setPoiStatus,
  updatePoi,
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

  it("laesst Kurztext und Langtext leer, wenn der Entwurf keine traegt (req-044)", async () => {
    const pool = createTestDb();

    const [created] = await createPois(pool, SUDITALIEN_TRIP_ID, [
      {
        name: "Trulli di Alberobello",
        ort: "Alberobello",
        type: "sehenswuerdigkeit",
        position: { lat: 40.78, lng: 17.24 },
      },
    ]);

    const gelesen = (await listPois(pool, ACCOUNT_ID)).find(
      (p) => p.id === created.id,
    );
    expect(gelesen?.shortText).toBeUndefined();
    expect(gelesen?.longText).toBeUndefined();
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
      shortText: null,
      longText: null,
      address: null,
      phone: null,
      openingHours: null,
      durationMinutes: null,
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

  it("legt Kurztext und Langtext mit an (req-044)", async () => {
    const pool = createTestDb();

    const angelegt = await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      bucht({
        shortText: "Kleine Bucht unterhalb der Straße",
        longText: "Zugang über eine lange Treppe, Schatten am Nachmittag.",
      }),
    );

    expect(angelegt).toMatchObject({
      shortText: "Kleine Bucht unterhalb der Straße",
      longText: "Zugang über eine lange Treppe, Schatten am Nachmittag.",
    });
    const gelesen = (await listPois(pool, ACCOUNT_ID)).find(
      (p) => p.id === angelegt?.id,
    );
    expect(gelesen?.shortText).toBe("Kleine Bucht unterhalb der Straße");
  });

  it("legt einen POI ohne Texte ohne sie an (req-044)", async () => {
    const pool = createTestDb();

    const angelegt = await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      bucht(),
    );

    expect(angelegt?.shortText).toBeUndefined();
    expect(angelegt?.longText).toBeUndefined();
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
      shortText: poi.shortText ?? null,
      longText: poi.longText ?? null,
      address: poi.address ?? null,
      phone: poi.phone ?? null,
      openingHours: poi.openingHours ?? null,
      durationMinutes: poi.durationMinutes ?? null,
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

  it("vermerkt einen geaenderten Kurztext als von Hand geaendert (req-044)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, { shortText: "Gärten mit Meerblick" }),
    );

    expect(geaendert?.shortText).toBe("Gärten mit Meerblick");
    const { rows } = await pool.query(
      `select manual_fields from poi where id = $1`,
      [villa.id],
    );
    expect(rows[0].manual_fields).toBe("shortText");
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

  it("vermerkt nicht als von Hand geaendert, was das Suchfeld gefuellt hat (req-048)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, {
        name: "Villa Cimbrone",
        shortText: "Terrasse der Unendlichkeit",
      }),
      { autoFilled: ["name", "shortText"] },
    );

    const { rows } = await pool.query(
      `select name, manual_fields from poi where id = $1`,
      [villa.id],
    );
    expect(rows[0]).toMatchObject({
      name: "Villa Cimbrone",
      manual_fields: "",
    });
  });

  it("vermerkt neben dem Gefuellten das selbst Getippte (req-048)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    // Das Suchfeld hat den Kurztext gefuellt, den Namen habe ich danach
    // selbst geaendert -- nur er ist vor dem Auffrischen geschuetzt.
    await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, {
        name: "Mein Lieblingsort",
        shortText: "Terrasse der Unendlichkeit",
      }),
      { autoFilled: ["shortText"] },
    );

    const { rows } = await pool.query(
      `select manual_fields from poi where id = $1`,
      [villa.id],
    );
    expect(rows[0].manual_fields).toBe("name");
  });

  it("merkt sich den Ort bei Google, aus dem das Formular gefuellt wurde (req-048)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa),
      {
        google: {
          placeId: "ChIJVillaRufolo",
          bewertung: 4.6,
          bewertungAnzahl: 1240,
          photoNames: [],
        },
      },
    );

    expect(geaendert).toMatchObject({
      googlePlaceId: "ChIJVillaRufolo",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
    });
  });

  it("laesst die Kennung bei Google stehen, wenn ohne Suchfeld gespeichert wird (req-048)", async () => {
    const pool = createTestDb();
    const pois = await listPois(pool, ACCOUNT_ID);
    const villa = pois.find((p) => p.name === "Villa Rufolo")!;
    await updatePoi(pool, ACCOUNT_ID, villa.id, ausPoi(villa), {
      google: {
        placeId: "ChIJVillaRufolo",
        bewertung: null,
        bewertungAnzahl: null,
        photoNames: [],
      },
    });

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      villa.id,
      ausPoi(villa, { name: "Villa Rufolo (Garten)" }),
    );

    expect(geaendert?.googlePlaceId).toBe("ChIJVillaRufolo");
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

/**
 * Was die KI-Suche seit req-057 mitbringt: die Angaben aus Google Places
 * samt Bewertung und dem Satz, warum die KI den Ort vorschlaegt.
 */
describe("createPois mit den Angaben aus Google (req-057)", () => {
  const SUDITALIEN_TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

  const AUS_DER_SUCHE = {
    name: "Trulli di Alberobello",
    ort: "Alberobello",
    type: "sehenswuerdigkeit" as const,
    position: { lat: 40.78, lng: 17.24 },
    shortText: "Kegelhäuser aus Kalkstein.",
    longText: "Kegelhäuser aus Kalkstein, seit 1996 Weltkulturerbe.",
    address: "Via Monte Nero, 70011 Alberobello BA, Italien",
    phone: "+39 080 4321000",
    openingHours: ["Montag: 09:00–18:00", "Dienstag: 09:00–18:00"],
    googlePlaceId: "ChIJTrulli",
    bewertung: 4.6,
    bewertungAnzahl: 1240,
    kiBegruendung: "Passt zu eurem Interesse an Geschichte.",
  };

  it("speichert Bewertung, Anzahl und Begruendung und liest sie wieder aus", async () => {
    const pool = createTestDb();

    const [created] = await createPois(pool, SUDITALIEN_TRIP_ID, [
      AUS_DER_SUCHE,
    ]);

    const gelesen = (await listPois(pool, ACCOUNT_ID)).find(
      (p) => p.id === created.id,
    );
    expect(gelesen).toMatchObject({
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      kiBegruendung: "Passt zu eurem Interesse an Geschichte.",
    });
  });

  it("speichert Beschreibung, Anschrift, Telefon und Oeffnungszeiten", async () => {
    const pool = createTestDb();

    const [created] = await createPois(pool, SUDITALIEN_TRIP_ID, [
      AUS_DER_SUCHE,
    ]);

    const gelesen = (await listPois(pool, ACCOUNT_ID)).find(
      (p) => p.id === created.id,
    );
    expect(gelesen).toMatchObject({
      shortText: "Kegelhäuser aus Kalkstein.",
      longText: "Kegelhäuser aus Kalkstein, seit 1996 Weltkulturerbe.",
      address: "Via Monte Nero, 70011 Alberobello BA, Italien",
      phone: "+39 080 4321000",
      openingHours: ["Montag: 09:00–18:00", "Dienstag: 09:00–18:00"],
      googlePlaceId: "ChIJTrulli",
    });
  });

  it("laesst die Bewertung offen, wenn der Ort keine hat", async () => {
    const pool = createTestDb();

    const [created] = await createPois(pool, SUDITALIEN_TRIP_ID, [
      { ...AUS_DER_SUCHE, bewertung: undefined, bewertungAnzahl: undefined },
    ]);

    const gelesen = (await listPois(pool, ACCOUNT_ID)).find(
      (p) => p.id === created.id,
    );
    expect(gelesen?.bewertung).toBeUndefined();
    expect(gelesen?.bewertungAnzahl).toBeUndefined();
  });
});

/**
 * Mehrere angekreuzte POIs auf einmal aussortieren (req-057). Jeder geht
 * denselben Weg wie beim Entfernen von Hand (req-035).
 */
describe("deletePois (req-057)", () => {
  const SUDITALIEN_TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

  it("entfernt genau die genannten POIs", async () => {
    const pool = createTestDb();
    const vorher = (await listPois(pool, ACCOUNT_ID)).filter(
      (p) => p.tripId === SUDITALIEN_TRIP_ID,
    );
    const zuEntfernen = vorher.slice(0, 3).map((p) => p.id);

    const entfernt = await deletePois(pool, ACCOUNT_ID, zuEntfernen);

    expect(entfernt.pois.map((p) => p.id).sort()).toEqual(
      [...zuEntfernen].sort(),
    );
    const nachher = await listPois(pool, ACCOUNT_ID);
    expect(nachher.some((p) => zuEntfernen.includes(p.id))).toBe(false);
  });

  it("laesst die uebrigen POIs der Reise stehen", async () => {
    const pool = createTestDb();
    const vorher = (await listPois(pool, ACCOUNT_ID)).filter(
      (p) => p.tripId === SUDITALIEN_TRIP_ID,
    );

    await deletePois(pool, ACCOUNT_ID, [vorher[0].id]);

    const nachher = await listPois(pool, ACCOUNT_ID);
    expect(nachher.filter((p) => p.tripId === SUDITALIEN_TRIP_ID)).toHaveLength(
      vorher.length - 1,
    );
  });

  it("liefert die Dateinamen der Bilder, damit der Aufrufer sie raeumt", async () => {
    const pool = createTestDb();
    const villa = (await listPois(pool, ACCOUNT_ID)).find(
      (p) => p.name === "Villa Rufolo",
    )!;
    await replacePoiPhotos(pool, villa.id, ["a.jpg", "b.jpg"], new Date());

    const entfernt = await deletePois(pool, ACCOUNT_ID, [villa.id]);

    expect(entfernt.removedFileNames.sort()).toEqual(["a.jpg", "b.jpg"]);
    const { rows } = await pool.query(
      "select id from poi_photo where poi_id = $1",
      [villa.id],
    );
    expect(rows).toHaveLength(0);
  });

  it("uebergeht einen POI eines anderen Accounts (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitPoi(pool);
    const eigener = (await listPois(pool, ACCOUNT_ID))[0];

    const entfernt = await deletePois(pool, ACCOUNT_ID, [
      fremd.poiId,
      eigener.id,
    ]);

    expect(entfernt.pois.map((p) => p.id)).toEqual([eigener.id]);
    const { rows } = await pool.query("select id from poi where id = $1", [
      fremd.poiId,
    ]);
    expect(rows).toHaveLength(1);
  });

  it("entfernt nichts bei einer leeren Liste", async () => {
    const pool = createTestDb();
    const vorher = await listPois(pool, ACCOUNT_ID);

    const entfernt = await deletePois(pool, ACCOUNT_ID, []);

    expect(entfernt.pois).toEqual([]);
    expect(await listPois(pool, ACCOUNT_ID)).toHaveLength(vorher.length);
  });
});

/**
 * Je Reise darf dieselbe Kennung bei Google nur einmal vorkommen
 * (`poi_trip_google_place_id_key`). Wer denselben Ort über das Suchfeld ein
 * zweites Mal anlegt, bekommt ihn trotzdem — nur ohne die Kennung (req-048).
 */
describe("Derselbe Google-Ort ein zweites Mal (req-048)", () => {
  const SUDITALIEN_TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

  function ausGoogle() {
    return {
      google: {
        placeId: "ChIJVillaCimbrone",
        bewertung: 4.6,
        bewertungAnzahl: 1240,
        photoNames: [],
      },
    };
  }

  function villaCimbrone(): PoiValues {
    return {
      name: "Villa Cimbrone",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6465, lng: 14.6127 },
      status: "weiss_nicht",
      web: null,
      shortText: null,
      longText: null,
      address: null,
      phone: null,
      openingHours: null,
      durationMinutes: null,
    };
  }

  it("legt den zweiten POI ohne die Kennung an, statt zu scheitern", async () => {
    const pool = createTestDb();
    const erster = await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaCimbrone(),
      ausGoogle(),
    );

    const zweiter = await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaCimbrone(),
      ausGoogle(),
    );

    expect(erster?.googlePlaceId).toBe("ChIJVillaCimbrone");
    expect(zweiter?.name).toBe("Villa Cimbrone");
    expect(zweiter?.googlePlaceId).toBeUndefined();
    // Die übrigen Angaben aus Google bleiben ihm.
    expect(zweiter?.bewertung).toBe(4.6);
  });

  it("lässt einen POI denselben Ort behalten, wenn er ihn schon war", async () => {
    const pool = createTestDb();
    const angelegt = (await createPoi(
      pool,
      ACCOUNT_ID,
      SUDITALIEN_TRIP_ID,
      villaCimbrone(),
      ausGoogle(),
    ))!;

    const geaendert = await updatePoi(
      pool,
      ACCOUNT_ID,
      angelegt.id,
      { ...villaCimbrone(), name: "Villa Cimbrone (Garten)" },
      ausGoogle(),
    );

    expect(geaendert?.googlePlaceId).toBe("ChIJVillaCimbrone");
  });
});
