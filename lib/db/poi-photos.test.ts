// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { deleteTrip } from "./trips";
import { listPois } from "./pois";
import {
  findPhotoFileName,
  listPhotoFileNamesOfTrip,
  listPhotosOfPoi,
  listPoiPhotos,
  replacePoiPhotos,
} from "./poi-photos";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const JETZT = new Date("2026-09-03T10:00:00Z");

let pool: ReturnType<typeof createTestDb>;

beforeEach(() => {
  pool = createTestDb();
});

async function ersterPoi(): Promise<string> {
  const pois = await listPois(pool, ACCOUNT_ID);
  return pois.find((p) => p.tripId === SUEDITALIEN_ID)!.id;
}

/** Ein zweiter Mandant mit eigener Reise, eigenem POI und eigenem Foto. */
async function fremdesFoto(): Promise<string> {
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
  const { photos } = await replacePoiPhotos(pool, poiId, ["fremd.jpg"], JETZT);
  return photos[0].id;
}

describe("replacePoiPhotos (req-026)", () => {
  it("legt zu drei Dateien drei Datensaetze in ihrer Reihenfolge an", async () => {
    const poiId = await ersterPoi();

    const { photos } = await replacePoiPhotos(
      pool,
      poiId,
      ["a.jpg", "b.jpg", "c.jpg"],
      JETZT,
    );

    expect(photos.map((p) => p.position)).toEqual([1, 2, 3]);
    expect(await listPhotosOfPoi(pool, poiId)).toHaveLength(3);
  });

  it("nennt beim Auffrischen die abgeloesten Dateien, damit keine verwaist", async () => {
    const poiId = await ersterPoi();
    await replacePoiPhotos(pool, poiId, ["alt-1.jpg", "alt-2.jpg"], JETZT);

    const { removedFileNames, photos } = await replacePoiPhotos(
      pool,
      poiId,
      ["neu.jpg"],
      JETZT,
    );

    expect(removedFileNames.sort()).toEqual(["alt-1.jpg", "alt-2.jpg"]);
    expect(photos).toHaveLength(1);
  });
});

describe("listPoiPhotos (req-026)", () => {
  it("buendelt die Fotos je POI", async () => {
    const poiId = await ersterPoi();
    await replacePoiPhotos(pool, poiId, ["a.jpg", "b.jpg"], JETZT);

    const nachPoi = await listPoiPhotos(pool, ACCOUNT_ID);

    expect(nachPoi.get(poiId)?.map((f) => f.position)).toEqual([1, 2]);
  });

  it("liefert keine Fotos eines anderen Accounts (Mandantentrennung)", async () => {
    await fremdesFoto();

    const nachPoi = await listPoiPhotos(pool, ACCOUNT_ID);

    expect([...nachPoi.values()].flat()).toHaveLength(0);
  });
});

describe("findPhotoFileName (req-026)", () => {
  it("liefert den Dateinamen eines eigenen Fotos", async () => {
    const poiId = await ersterPoi();
    const { photos } = await replacePoiPhotos(pool, poiId, ["a.jpg"], JETZT);

    expect(await findPhotoFileName(pool, ACCOUNT_ID, photos[0].id)).toBe(
      "a.jpg",
    );
  });

  it("liefert null fuer ein Foto eines anderen Accounts", async () => {
    const fremdeId = await fremdesFoto();

    expect(await findPhotoFileName(pool, ACCOUNT_ID, fremdeId)).toBeNull();
  });
});

describe("Fotos beim Loeschen der Reise (req-026)", () => {
  it("nennt vor dem Loeschen die Dateien der Reise", async () => {
    const poiId = await ersterPoi();
    await replacePoiPhotos(pool, poiId, ["a.jpg", "b.jpg"], JETZT);

    expect(
      (await listPhotoFileNamesOfTrip(pool, SUEDITALIEN_ID)).sort(),
    ).toEqual(["a.jpg", "b.jpg"]);
  });

  it("laesst nach dem Loeschen der Reise keinen Foto-Datensatz zurueck", async () => {
    const poiId = await ersterPoi();
    await replacePoiPhotos(pool, poiId, ["a.jpg"], JETZT);

    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    const { rows } = await pool.query("select id from poi_photo");
    expect(rows).toHaveLength(0);
  });
});
