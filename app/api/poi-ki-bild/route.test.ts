// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { AiClient } from "@/lib/ai/client";
import type { Poi, PoiPhoto } from "@/lib/pois/types";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

/**
 * OpenAI ist ein externer Dienst und wird gemockt (stack.md, Testing) --
 * kein Test haengt im Netz oder kostet ein Bild.
 */
const aussen = vi.hoisted(() => ({ createOpenAiClient: vi.fn() }));

vi.mock("@/lib/ai/openai-client", async (original) => ({
  ...(await original<typeof import("@/lib/ai/openai-client")>()),
  createOpenAiClient: aussen.createOpenAiClient,
}));
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
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { apiKeyMissingHint } = await import("@/lib/api-keys/types");
const { AI_FEHLER_TEXT } = await import("@/lib/ai/fehler");
const { POST } = await import("./route");

let bildablage: string;

function anfrage(body: unknown): Request {
  return new Request("https://dev.wegfara.com/api/poi-ki-bild", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Angemeldet und mit hinterlegtem Zugangsschluessel fuer die KI (req-028). */
async function mitKiSchluessel() {
  await angemeldet();
  await storeAccountApiKey(
    testDb.pool,
    ACCOUNT_ID,
    "ki_suche",
    "sk-test-4711",
    new Date(),
  );
}

async function villaRufolo(): Promise<Poi> {
  const pois = await listPois(testDb.pool, ACCOUNT_ID);
  return pois.find((poi) => poi.name === "Villa Rufolo")!;
}

/** Ein POI eines anderen Accounts -- fuer diese Sitzung gibt es ihn nicht. */
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

/** Die KI antwortet mit einem Bild. */
function kiLiefertBild(inhalt = "png-bytes") {
  const generateImage = vi.fn(async (prompt: string) => {
    void prompt;
    return {
      ok: true as const,
      bild: {
        data: new Uint8Array(Buffer.from(inhalt)),
        contentType: "image/png",
      },
    };
  });
  aussen.createOpenAiClient.mockImplementation(
    () => ({ generateImage }) as unknown as AiClient,
  );
  return generateImage;
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.IMAGE_DIR = bildablage;
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
});

afterEach(async () => {
  await rm(bildablage, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
  aussen.createOpenAiClient.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/poi-ki-bild (req-072)", () => {
  it("verlangt eine Anmeldung", async () => {
    const poi = await villaRufolo();

    expect((await POST(anfrage({ poiId: poi.id }))).status).toBe(401);
  });

  it("legt Datei und Datensatz an und liefert die Bilder des POI", async () => {
    await mitKiSchluessel();
    kiLiefertBild();
    const poi = await villaRufolo();
    const vorher = (await listPhotosOfPoi(testDb.pool, poi.id)).length;

    const response = await POST(anfrage({ poiId: poi.id }));

    expect(response.status).toBe(201);
    const { photos } = (await response.json()) as { photos: PoiPhoto[] };
    expect(photos).toHaveLength(vorher + 1);
    expect(await readdir(bildablage)).toHaveLength(1);
    expect(await listPhotosOfPoi(testDb.pool, poi.id)).toHaveLength(vorher + 1);
  });

  /**
   * Die Herkunft steht in der Datenbank (req-072, Constraints) -- an ihr
   * haengt spaeter das Symbol, nicht am Dateinamen.
   */
  it("vermerkt das Bild als von der KI erzeugt", async () => {
    await mitKiSchluessel();
    kiLiefertBild();
    const poi = await villaRufolo();

    await POST(anfrage({ poiId: poi.id }));

    const fotos = await listPhotosOfPoi(testDb.pool, poi.id);
    expect(fotos.at(-1)?.source).toBe("ki");
    const { rows } = await testDb.pool.query(
      "select source from poi_photo where id = $1",
      [fotos.at(-1)!.id],
    );
    expect(rows[0].source).toBe("ki");
  });

  it("nimmt Titel und Beschreibung des POI als Vorlage", async () => {
    await mitKiSchluessel();
    const generateImage = kiLiefertBild();
    const poi = await villaRufolo();

    await POST(anfrage({ poiId: poi.id }));

    const aufforderung = generateImage.mock.calls[0][0];
    expect(aufforderung).toContain(poi.name);
    expect(aufforderung).toMatch(/fotorealistisch/i);
  });

  it("rechnet ueber den Zugangsschluessel des Accounts ab (req-028)", async () => {
    await mitKiSchluessel();
    kiLiefertBild();
    const poi = await villaRufolo();

    await POST(anfrage({ poiId: poi.id }));

    expect(aussen.createOpenAiClient).toHaveBeenCalledWith({
      apiKey: "sk-test-4711",
    });
  });

  it("benennt die Datei nach eigener Kennung", async () => {
    await mitKiSchluessel();
    kiLiefertBild();
    const poi = await villaRufolo();

    await POST(anfrage({ poiId: poi.id }));

    const [dateiname] = await readdir(bildablage);
    expect(dateiname).toMatch(/^[0-9a-f-]{36}\.png$/);
  });

  it("erzeugt kein Bild an einem POI eines anderen Accounts (req-024)", async () => {
    await mitKiSchluessel();
    kiLiefertBild();
    const poiId = await fremderPoi();

    const response = await POST(anfrage({ poiId }));

    expect(response.status).toBe(404);
    expect(await readdir(bildablage)).toEqual([]);
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
  });

  it("weist eine Anfrage ohne POI ab", async () => {
    await mitKiSchluessel();

    expect((await POST(anfrage({}))).status).toBe(400);
  });

  it("sagt, wenn der Zugangsschluessel fehlt, und erzeugt kein Bild", async () => {
    await angemeldet();
    const poi = await villaRufolo();

    const response = await POST(anfrage({ poiId: poi.id }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: apiKeyMissingHint("ki_suche"),
    });
    expect(await readdir(bildablage)).toEqual([]);
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
  });

  /**
   * Ein Fehlschlag wird benannt und nicht verschluckt (bug-021, bug-032) --
   * und es bleibt nichts Halbes zurueck (req-072).
   */
  it("nennt den Grund, wenn die KI kein Bild liefert, und legt nichts ab", async () => {
    const poi = await villaRufolo();
    await mitKiSchluessel();
    const vorher = (await listPhotosOfPoi(testDb.pool, poi.id)).length;
    aussen.createOpenAiClient.mockImplementation(
      () =>
        ({
          generateImage: vi.fn(async () => ({
            ok: false as const,
            fehler: { art: "kontingent" as const, detail: "quota exceeded" },
          })),
        }) as unknown as AiClient,
    );

    const response = await POST(anfrage({ poiId: poi.id }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: AI_FEHLER_TEXT.kontingent,
    });
    expect(await readdir(bildablage)).toEqual([]);
    expect(await listPhotosOfPoi(testDb.pool, poi.id)).toHaveLength(vorher);
  });
});
