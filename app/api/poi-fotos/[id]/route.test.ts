// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

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

function anfrage(id: string) {
  return {
    request: new Request(`https://dev.wegfara.com/api/poi-fotos/${id}`),
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
