// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { listPois } from "@/lib/db/pois";
import { uebernehmeGoogleFotos, type GooglePhotoSource } from "./google-photos";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const JETZT = new Date("2026-09-10T10:00:00Z");

let pool: ReturnType<typeof createTestDb>;
let dir: string;

beforeEach(async () => {
  pool = createTestDb();
  dir = await mkdtemp(path.join(tmpdir(), "wegfara-google-fotos-"));
  process.env.IMAGE_DIR = dir;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

/**
 * Eine Ablage, in die sich nichts schreiben laesst. Auf dev war es das
 * gemountete Verzeichnis, das einem anderen Benutzer gehoerte (EACCES,
 * bug-027); hier steht an seiner Stelle eine gewoehnliche Datei -- das
 * scheitert bei jedem Benutzer gleich, auch bei root.
 */
async function unbeschreibbareAblage(): Promise<void> {
  const sperre = path.join(dir, "keine-ablage");
  await writeFile(sperre, "");
  process.env.IMAGE_DIR = sperre;
}

async function ersterPoi(): Promise<string> {
  const pois = await listPois(pool, ACCOUNT_ID);
  return pois.find((p) => p.tripId === SUEDITALIEN_ID)!.id;
}

/** Google gibt jedes angefragte Bild heraus. */
const liefertBilder: GooglePhotoSource = {
  async fetchPhoto() {
    return new Uint8Array([1, 2, 3]);
  },
};

describe("uebernehmeGoogleFotos (req-026, bug-027)", () => {
  it("legt die Fotos ab und meldet kein Problem", async () => {
    const poiId = await ersterPoi();

    const ergebnis = await uebernehmeGoogleFotos(
      pool,
      poiId,
      ["places/a/photos/1", "places/a/photos/2"],
      liefertBilder,
      JETZT,
    );

    expect(ergebnis.problem).toBeNull();
    expect(ergebnis.photos).toHaveLength(2);
    expect(await readdir(dir)).toHaveLength(2);
  });

  it("meldet eine nicht nutzbare Bildablage, statt still leer zu bleiben", async () => {
    // Ohne IMAGE_DIR gibt es keine Ablage -- genau der Fall aus bug-027,
    // in dem der POI ohne Bilder und ohne Meldung entstand.
    delete process.env.IMAGE_DIR;
    const poiId = await ersterPoi();

    const ergebnis = await uebernehmeGoogleFotos(
      pool,
      poiId,
      ["places/a/photos/1"],
      liefertBilder,
      JETZT,
    );

    expect(ergebnis.problem).toBe("ablage_fehlt");
    expect(ergebnis.photos).toEqual([]);
  });

  it("meldet ein Bild, das sich nicht ablegen laesst", async () => {
    // Das gemountete Bildverzeichnis gehoerte auf dem Host einem anderen
    // Benutzer; ein Schreibversuch scheiterte mit EACCES (bug-027). Der
    // catch im Uebernehmen verschluckte das wortlos.
    const poiId = await ersterPoi();
    await unbeschreibbareAblage();

    const ergebnis = await uebernehmeGoogleFotos(
      pool,
      poiId,
      ["places/a/photos/1"],
      liefertBilder,
      JETZT,
    );

    expect(ergebnis.problem).toBe("nicht_gespeichert");
    expect(ergebnis.photos).toEqual([]);
  });

  it("meldet ein Bild, das Google nicht herausgibt", async () => {
    const poiId = await ersterPoi();

    const ergebnis = await uebernehmeGoogleFotos(
      pool,
      poiId,
      ["places/a/photos/1", "places/a/photos/2"],
      {
        async fetchPhoto(photoName) {
          return photoName.endsWith("2") ? null : new Uint8Array([1]);
        },
      },
      JETZT,
    );

    expect(ergebnis.problem).toBe("nicht_geholt");
    // Das eine Bild, das kam, ist trotzdem da.
    expect(ergebnis.photos).toHaveLength(1);
  });

  it("nennt die unbeschreibbare Ablage vor dem fehlenden Bild", async () => {
    const poiId = await ersterPoi();
    await unbeschreibbareAblage();

    const ergebnis = await uebernehmeGoogleFotos(
      pool,
      poiId,
      ["places/a/photos/1", "places/a/photos/2"],
      {
        async fetchPhoto(photoName) {
          return photoName.endsWith("2") ? null : new Uint8Array([1]);
        },
      },
      JETZT,
    );

    expect(ergebnis.problem).toBe("nicht_gespeichert");
  });
});
