// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { deleteTrip } from "./trips";
import { deletePoi, listPois } from "./pois";
import { addPoiPhoto, deletePoiPhoto } from "./poi-photos";
import {
  entferneTitelfoto,
  findEigenesTitelfotoFileName,
  findTripTitelfoto,
  listTripTitelfotos,
  setzeEigenesTitelfoto,
  waehlePoiTitelfoto,
} from "./trip-titelfoto";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const JETZT = new Date("2026-10-28T10:00:00Z");

let pool: ReturnType<typeof createTestDb>;

beforeEach(() => {
  pool = createTestDb();
});

async function poisDerReise() {
  return (await listPois(pool, ACCOUNT_ID)).filter(
    (poi) => poi.tripId === SUEDITALIEN_ID,
  );
}

/** Ein Foto an einem POI der Reise Sueditalien. */
async function fotoDerReise(index = 0): Promise<{ poiId: string; id: string }> {
  const poiId = (await poisDerReise())[index].id;
  const photos = await addPoiPhoto(
    pool,
    ACCOUNT_ID,
    poiId,
    `${randomUUID()}.jpg`,
    JETZT,
  );
  return { poiId, id: photos!.at(-1)!.id };
}

/** Eine zweite Reise desselben Accounts mit einem Foto daran. */
async function fotoEinerAnderenReise(): Promise<string> {
  const tripId = randomUUID();
  const poiId = randomUUID();
  await pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Andere Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, ACCOUNT_ID],
  );
  await pool.query(
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status)
     values ($1, $2, 1, 'Anderer POI', 'Berlin', 'sehenswuerdigkeit', 52.52, 13.405, 'weiss_nicht')`,
    [poiId, tripId],
  );
  const photos = await addPoiPhoto(pool, ACCOUNT_ID, poiId, "x.jpg", JETZT);
  return photos![0].id;
}

describe("Titelfoto einer Reise (req-103)", () => {
  it("hat ohne Wahl keines -- dann gilt die Vorgabe", async () => {
    expect(await findTripTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(
      null,
    );
  });

  it("merkt sich ein gewaehltes Foto der Reise", async () => {
    const foto = await fotoDerReise();

    const ergebnis = await waehlePoiTitelfoto(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      foto.id,
      JETZT,
    );

    expect(ergebnis?.titelfoto).toEqual({
      tripId: SUEDITALIEN_ID,
      art: "poi",
      photoId: foto.id,
    });
    expect(await findTripTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toEqual(
      ergebnis?.titelfoto,
    );
    expect(await listTripTitelfotos(pool, ACCOUNT_ID)).toEqual([
      ergebnis?.titelfoto,
    ]);
  });

  it("laesst kein Foto einer anderen Reise waehlen", async () => {
    const fremd = await fotoEinerAnderenReise();

    expect(
      await waehlePoiTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID, fremd, JETZT),
    ).toBeNull();
    expect(await findTripTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(
      null,
    );
  });

  it("gilt fuer einen anderen Account nicht", async () => {
    const foto = await fotoDerReise();
    await waehlePoiTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID, foto.id, JETZT);

    expect(await findTripTitelfoto(pool, randomUUID(), SUEDITALIEN_ID)).toBe(
      null,
    );
    expect(
      await setzeEigenesTitelfoto(
        pool,
        randomUUID(),
        SUEDITALIEN_ID,
        "x.jpg",
        "manuell",
        JETZT,
      ),
    ).toBeNull();
  });

  it("faellt zurueck, wenn das gewaehlte Foto entfernt wird", async () => {
    const foto = await fotoDerReise();
    await waehlePoiTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID, foto.id, JETZT);

    await deletePoiPhoto(pool, ACCOUNT_ID, foto.id);

    expect(await findTripTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(
      null,
    );
  });

  it("faellt zurueck, wenn der POI des gewaehlten Fotos entfernt wird", async () => {
    const foto = await fotoDerReise();
    await waehlePoiTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID, foto.id, JETZT);

    await deletePoi(pool, ACCOUNT_ID, foto.poiId);

    expect(await findTripTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(
      null,
    );
  });

  it("legt ein eigenes Bild ab und nennt beim Ersetzen die alte Datei", async () => {
    const erstes = await setzeEigenesTitelfoto(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "eigen-1.jpg",
      "manuell",
      JETZT,
    );
    expect(erstes?.titelfoto).toMatchObject({
      art: "eigen",
      istKiBild: false,
    });
    expect(erstes?.removedFileName).toBeNull();
    expect(
      await findEigenesTitelfotoFileName(pool, ACCOUNT_ID, SUEDITALIEN_ID),
    ).toBe("eigen-1.jpg");

    const zweites = await setzeEigenesTitelfoto(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "eigen-2.png",
      "ki",
      JETZT,
    );
    expect(zweites?.removedFileName).toBe("eigen-1.jpg");
    expect(
      await findTripTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID),
    ).toMatchObject({ art: "eigen", istKiBild: true });
  });

  it("nennt die eigene Datei auch, wenn ein Foto der Reise sie abloest", async () => {
    await setzeEigenesTitelfoto(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "eigen.jpg",
      "manuell",
      JETZT,
    );
    const foto = await fotoDerReise();

    const ergebnis = await waehlePoiTitelfoto(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      foto.id,
      JETZT,
    );

    expect(ergebnis?.removedFileName).toBe("eigen.jpg");
    expect(
      await findEigenesTitelfotoFileName(pool, ACCOUNT_ID, SUEDITALIEN_ID),
    ).toBeNull();
  });

  it("nimmt die Wahl zurueck", async () => {
    await setzeEigenesTitelfoto(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "eigen.jpg",
      "manuell",
      JETZT,
    );

    expect(await entferneTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toEqual({
      removedFileName: "eigen.jpg",
    });
    expect(await findTripTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(
      null,
    );
  });

  it("verschwindet mit der Reise", async () => {
    const foto = await fotoDerReise();
    await waehlePoiTitelfoto(pool, ACCOUNT_ID, SUEDITALIEN_ID, foto.id, JETZT);

    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    expect(await listTripTitelfotos(pool, ACCOUNT_ID)).toEqual([]);
  });
});
