// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { bildMasse, testFoto } from "@/tests/testfoto";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { createSession } = await import("@/lib/db/sessions");
const { listPois } = await import("@/lib/db/pois");
const { replacePoiPhotos } = await import("@/lib/db/poi-photos");
const { fileSystemPhotoStore } = await import("@/lib/images/photo-store");
const { GET } = await import("./route");

let bildablage: string;

function anfrage(id: string, suche = "") {
  return {
    request: new Request(`https://dev.wegfara.com/api/poi-fotos/${id}${suche}`),
    kontext: { params: Promise.resolve({ id }) },
  };
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Ein Foto am ersten POI des Accounts, Datei inklusive. */
async function eigenesFoto(mitDatei = true): Promise<string> {
  const pois = await listPois(testDb.pool, ACCOUNT_ID);
  const { photos } = await replacePoiPhotos(
    testDb.pool,
    pois[0].id,
    ["foto.jpg"],
    new Date(),
  );
  if (mitDatei) {
    await fileSystemPhotoStore(bildablage).save(
      "foto.jpg",
      new Uint8Array([1, 2, 3]),
    );
  }
  return photos[0].id;
}

async function fremdesFoto(): Promise<string> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const poiId = randomUUID();
  await testDb.pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await testDb.pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  await testDb.pool.query(
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status)
     values ($1, $2, 1, 'Fremder POI', 'Berlin', 'sehenswuerdigkeit', 52.52, 13.405, 'weiss_nicht')`,
    [poiId, tripId],
  );
  const { photos } = await replacePoiPhotos(
    testDb.pool,
    poiId,
    ["fremd.jpg"],
    new Date(),
  );
  await fileSystemPhotoStore(bildablage).save(
    "fremd.jpg",
    new Uint8Array([9, 9, 9]),
  );
  return photos[0].id;
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.IMAGE_DIR = bildablage;
});

afterEach(async () => {
  await rm(bildablage, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("GET /api/poi-fotos/[id] (req-026)", () => {
  it("verlangt eine Anmeldung", async () => {
    const id = await eigenesFoto();
    const { request, kontext } = anfrage(id);

    expect((await GET(request, kontext)).status).toBe(401);
  });

  it("liefert die Bilddatei aus der Ablage", async () => {
    await angemeldet();
    const id = await eigenesFoto();
    const { request, kontext } = anfrage(id);

    const response = await GET(request, kontext);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
  });

  it("liefert kein Foto eines anderen Accounts", async () => {
    await angemeldet();
    const id = await fremdesFoto();
    const { request, kontext } = anfrage(id);

    expect((await GET(request, kontext)).status).toBe(404);
  });

  it("liefert nichts, wenn zum Datensatz die Datei fehlt", async () => {
    await angemeldet();
    const id = await eigenesFoto(false);
    const { request, kontext } = anfrage(id);

    expect((await GET(request, kontext)).status).toBe(404);
  });
});

describe("GET /api/poi-fotos/[id]?groesse=miniatur (req-105)", () => {
  /** Ein Foto am ersten POI, abgelegt wie beim Speichern -- samt Miniatur. */
  async function fotoMitMiniatur(
    fileName = "foto.jpg",
    art: "jpeg" | "png" = "jpeg",
  ): Promise<string> {
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const { photos } = await replacePoiPhotos(
      testDb.pool,
      pois[0].id,
      [fileName],
      new Date(),
    );
    await fileSystemPhotoStore(bildablage).save(
      fileName,
      await testFoto({ breite: 1200, hoehe: 800, art }),
    );
    return photos[0].id;
  }

  it("liefert die Miniatur von 320 Punkten, wenn sie gewuenscht ist", async () => {
    await angemeldet();
    const id = await fotoMitMiniatur();
    const { request, kontext } = anfrage(id, "?groesse=miniatur");

    const response = await GET(request, kontext);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    const daten = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get("Content-Length")).toBe(
      String(daten.byteLength),
    );
    expect((await bildMasse(daten)).breite).toBe(320);
  });

  it("liefert ohne den Wunsch das Original in voller Aufloesung", async () => {
    await angemeldet();
    const id = await fotoMitMiniatur();
    const { request, kontext } = anfrage(id);

    const response = await GET(request, kontext);

    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(
      (await bildMasse(new Uint8Array(await response.arrayBuffer()))).breite,
    ).toBe(1200);
  });

  it("liefert das Original, wenn die Miniatur fehlt -- nie ein leeres Bild", async () => {
    await angemeldet();
    const id = await eigenesFoto();
    const { request, kontext } = anfrage(id, "?groesse=miniatur");

    const response = await GET(request, kontext);

    expect(response.status).toBe(200);
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
  });

  it("liefert auch als Miniatur kein Foto eines anderen Accounts", async () => {
    await angemeldet();
    const id = await fremdesFoto();
    const { request, kontext } = anfrage(id, "?groesse=miniatur");

    expect((await GET(request, kontext)).status).toBe(404);
  });

  it("verlangt auch fuer die Miniatur eine Anmeldung", async () => {
    const id = await fotoMitMiniatur();
    const { request, kontext } = anfrage(id, "?groesse=miniatur");

    expect((await GET(request, kontext)).status).toBe(401);
  });

  it("bleibt bei 404, wenn zum Datensatz das Original fehlt", async () => {
    await angemeldet();
    const id = await eigenesFoto(false);
    const { request, kontext } = anfrage(id, "?groesse=miniatur");

    expect((await GET(request, kontext)).status).toBe(404);
  });

  /**
   * Die Datei, die ueber ihre Endung luegt: ein PNG unter `….jpg`. Die
   * Miniatur ist ein WebP und als solches ausgezeichnet; das Original geht
   * mit der Art hinaus, die sein Inhalt hat.
   */
  it("zeichnet ein PNG unter .jpg richtig aus", async () => {
    await angemeldet();
    const id = await fotoMitMiniatur(
      "49d541f8-971c-4aea-acd8-4a8b359c91e1.jpg",
      "png",
    );

    const miniatur = anfrage(id, "?groesse=miniatur");
    const kleineAntwort = await GET(miniatur.request, miniatur.kontext);
    expect(kleineAntwort.headers.get("Content-Type")).toBe("image/webp");
    expect(
      (await bildMasse(new Uint8Array(await kleineAntwort.arrayBuffer())))
        .format,
    ).toBe("webp");

    const original = anfrage(id);
    const grosseAntwort = await GET(original.request, original.kontext);
    expect(grosseAntwort.headers.get("Content-Type")).toBe("image/png");
  });
});

/**
 * Ein Bild, das sich nicht aendert, wird nicht neu geholt (req-105): nach
 * Ablauf des Tages aus `max-age` fragt der Browser mit `If-None-Match` nach
 * und bekommt ein 304 statt der Daten.
 */
describe("GET /api/poi-fotos/[id]: ETag (req-105)", () => {
  it("bestaetigt ein Bild, das der Browser schon hat, mit 304 ohne Daten", async () => {
    await angemeldet();
    const id = await eigenesFoto();
    const erste = anfrage(id);
    const etag = (await GET(erste.request, erste.kontext)).headers.get("ETag");
    expect(etag).toBeTruthy();

    const response = await GET(
      new Request(`https://dev.wegfara.com/api/poi-fotos/${id}`, {
        headers: { "If-None-Match": etag! },
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(304);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it("gibt Miniatur und Original verschiedene Kennzeichen", async () => {
    await angemeldet();
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const { photos } = await replacePoiPhotos(
      testDb.pool,
      pois[0].id,
      ["foto.jpg"],
      new Date(),
    );
    await fileSystemPhotoStore(bildablage).save("foto.jpg", await testFoto());
    const id = photos[0].id;

    const gross = anfrage(id);
    const klein = anfrage(id, "?groesse=miniatur");
    const etagGross = (await GET(gross.request, gross.kontext)).headers.get(
      "ETag",
    );
    const etagKlein = (await GET(klein.request, klein.kontext)).headers.get(
      "ETag",
    );

    expect(etagGross).not.toBe(etagKlein);
    const nachfrage = await GET(
      new Request(
        `https://dev.wegfara.com/api/poi-fotos/${id}?groesse=miniatur`,
        { headers: { "If-None-Match": etagGross! } },
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(nachfrage.status).toBe(200);
  });

  it("verlangt auch fuer die Bestaetigung eine Anmeldung", async () => {
    const id = await eigenesFoto();

    const response = await GET(
      new Request(`https://dev.wegfara.com/api/poi-fotos/${id}`, {
        headers: { "If-None-Match": "*" },
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(401);
  });
});
