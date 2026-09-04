// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { MAX_POI_PHOTO_BYTES, POI_PHOTO_ERRORS } from "@/lib/pois/photo-upload";
import type { PoiPhoto } from "@/lib/pois/types";

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
const { listPhotosOfPoi } = await import("@/lib/db/poi-photos");
const { DELETE, POST, PUT } = await import("./route");

let bildablage: string;

function bild(name = "bucht.jpg", type = "image/jpeg", inhalt = "bild"): File {
  return new File([inhalt], name, { type });
}

function hochladen(poiId: string, datei: File): Request {
  const body = new FormData();
  body.append("poiId", poiId);
  body.append("datei", datei);
  return new Request("https://dev.wegfara.com/api/poi-fotos", {
    method: "POST",
    body,
  });
}

function anfrage(method: "PUT" | "DELETE", body: unknown): Request {
  return new Request("https://dev.wegfara.com/api/poi-fotos", {
    method,
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function villaRufoloId(): Promise<string> {
  const pois = await listPois(testDb.pool, ACCOUNT_ID);
  return pois.find((poi) => poi.name === "Villa Rufolo")!.id;
}

/** Ein zweiter Account mit eigener Reise und eigenem POI. */
async function fremderPoi(): Promise<string> {
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
  return poiId;
}

async function hochgeladen(poiId: string, datei = bild()): Promise<PoiPhoto[]> {
  const response = await POST(hochladen(poiId, datei));
  const { photos } = (await response.json()) as { photos: PoiPhoto[] };
  return photos;
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

describe("POST /api/poi-fotos (req-035)", () => {
  it("verlangt eine Anmeldung", async () => {
    const poiId = await villaRufoloId();

    expect((await POST(hochladen(poiId, bild()))).status).toBe(401);
  });

  it("legt Datei und Datensatz an", async () => {
    await angemeldet();
    const poiId = await villaRufoloId();

    const response = await POST(hochladen(poiId, bild()));

    expect(response.status).toBe(201);
    const { photos } = (await response.json()) as { photos: PoiPhoto[] };
    expect(photos).toHaveLength(1);
    expect(await readdir(bildablage)).toHaveLength(1);
    expect(await listPhotosOfPoi(testDb.pool, poiId)).toHaveLength(1);
  });

  it("benennt die Datei nach eigener Kennung, nie nach dem hochgeladenen Namen", async () => {
    await angemeldet();
    const poiId = await villaRufoloId();

    await POST(hochladen(poiId, bild("../boese.jpg")));

    const [dateiname] = await readdir(bildablage);
    expect(dateiname).not.toContain("boese");
    expect(dateiname).toMatch(/^[0-9a-f-]{36}\.jpg$/);
  });

  it("weist eine Datei ueber 20 MB ab", async () => {
    await angemeldet();
    const poiId = await villaRufoloId();
    const zuGross = new File(
      ["x".repeat(MAX_POI_PHOTO_BYTES + 1)],
      "gross.jpg",
      { type: "image/jpeg" },
    );

    const response = await POST(hochladen(poiId, zuGross));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: POI_PHOTO_ERRORS.size });
    expect(await readdir(bildablage)).toEqual([]);
  });

  it("weist ab, was kein Bild ist", async () => {
    await angemeldet();
    const poiId = await villaRufoloId();

    const response = await POST(
      hochladen(poiId, bild("ticket.pdf", "application/pdf")),
    );

    expect(response.status).toBe(400);
    expect(await readdir(bildablage)).toEqual([]);
  });

  it("legt kein Bild an einem POI eines anderen Accounts ab (req-024)", async () => {
    await angemeldet();
    const poiId = await fremderPoi();

    const response = await POST(hochladen(poiId, bild()));

    expect(response.status).toBe(404);
    // Ohne Datensatz bleibt auch keine Datei zurueck.
    expect(await readdir(bildablage)).toEqual([]);
  });
});

describe("PUT /api/poi-fotos (req-035)", () => {
  it("setzt das zweite Bild an die erste Stelle", async () => {
    await angemeldet();
    const poiId = await villaRufoloId();
    await hochgeladen(poiId, bild("eins.jpg"));
    const photos = await hochgeladen(poiId, bild("zwei.jpg"));

    const response = await PUT(
      anfrage("PUT", {
        poiId,
        photoIds: [photos[1].id, photos[0].id],
      }),
    );

    expect(response.status).toBe(200);
    const { photos: neu } = (await response.json()) as { photos: PoiPhoto[] };
    expect(neu[0].id).toBe(photos[1].id);
    expect((await listPhotosOfPoi(testDb.pool, poiId))[0].id).toBe(
      photos[1].id,
    );
  });

  it("sortiert die Bilder eines anderen Accounts nicht um (req-024)", async () => {
    await angemeldet();
    const poiId = await fremderPoi();

    expect((await PUT(anfrage("PUT", { poiId, photoIds: [] }))).status).toBe(
      404,
    );
  });
});

describe("DELETE /api/poi-fotos (req-035)", () => {
  it("laesst im Bildverzeichnis keine Datei zurueck", async () => {
    await angemeldet();
    const poiId = await villaRufoloId();
    const photos = await hochgeladen(poiId);
    expect(await readdir(bildablage)).toHaveLength(1);

    const response = await DELETE(anfrage("DELETE", { photoId: photos[0].id }));

    expect(response.status).toBe(200);
    expect(await readdir(bildablage)).toEqual([]);
    expect(await listPhotosOfPoi(testDb.pool, poiId)).toEqual([]);
  });

  it("entfernt kein Bild eines anderen Accounts (req-024)", async () => {
    await angemeldet();

    expect(
      (await DELETE(anfrage("DELETE", { photoId: randomUUID() }))).status,
    ).toBe(404);
  });
});
