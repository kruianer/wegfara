// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { AiClient } from "@/lib/ai/client";
import type { TripTitelfoto } from "@/lib/trips/titelfoto";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
/** OpenAI wird gemockt (stack.md, Testing) -- kein Test kostet ein Bild. */
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
const { addPoiPhoto } = await import("@/lib/db/poi-photos");
const { findTripTitelfoto } = await import("@/lib/db/trip-titelfoto");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { apiKeyMissingHint } = await import("@/lib/api-keys/types");
const { POST, PUT } = await import("./route");
const { GET } = await import("./[tripId]/route");
const { POST: POST_KI } = await import("./ki/route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

let bildablage: string;

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

function hochladen(
  inhalt = "jpeg-bytes",
  typ = "image/jpeg",
  name = "titel.jpg",
): Request {
  const form = new FormData();
  form.append("tripId", SUEDITALIEN_ID);
  form.append("datei", new File([inhalt], name, { type: typ }));
  return new Request("https://dev.wegfara.com/api/reise-titelfoto", {
    method: "POST",
    body: form,
  });
}

function waehlen(photoId: string | null): Request {
  return new Request("https://dev.wegfara.com/api/reise-titelfoto", {
    method: "PUT",
    body: JSON.stringify({ tripId: SUEDITALIEN_ID, photoId }),
  });
}

async function fotoDerReise(): Promise<string> {
  const poi = (await listPois(testDb.pool, ACCOUNT_ID)).find(
    (p) => p.tripId === SUEDITALIEN_ID,
  )!;
  const photos = await addPoiPhoto(
    testDb.pool,
    ACCOUNT_ID,
    poi.id,
    "guggenheim.jpg",
    new Date(),
  );
  return photos!.at(-1)!.id;
}

async function titelfotoAus(response: Response): Promise<TripTitelfoto | null> {
  return ((await response.json()) as { titelfoto: TripTitelfoto | null })
    .titelfoto;
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-titel-"));
  process.env.IMAGE_DIR = bildablage;
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
});

afterEach(async () => {
  await rm(bildablage, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
  aussen.createOpenAiClient.mockReset();
  vi.unstubAllEnvs();
});

describe("/api/reise-titelfoto (req-103)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await PUT(waehlen(null))).status).toBe(401);
    expect((await POST(hochladen())).status).toBe(401);
  });

  it("waehlt ein Foto der Reise und nimmt die Wahl zurueck", async () => {
    await angemeldet();
    const photoId = await fotoDerReise();

    const gewaehlt = await PUT(waehlen(photoId));
    expect(gewaehlt.status).toBe(200);
    expect(await titelfotoAus(gewaehlt)).toEqual({
      tripId: SUEDITALIEN_ID,
      art: "poi",
      photoId,
    });

    const zurueck = await PUT(waehlen(null));
    expect(await titelfotoAus(zurueck)).toBeNull();
    expect(
      await findTripTitelfoto(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID),
    ).toBeNull();
  });

  it("weist ein unbekanntes Foto ab", async () => {
    await angemeldet();
    expect(
      (await PUT(waehlen("00000000-0000-4000-8000-000000000000"))).status,
    ).toBe(404);
  });

  it("legt ein hochgeladenes Bild in die Bildablage und liefert es aus", async () => {
    await angemeldet();

    const response = await POST(hochladen("mein-bild"));

    expect(response.status).toBe(201);
    expect(await titelfotoAus(response)).toMatchObject({
      art: "eigen",
      istKiBild: false,
    });
    expect(await readdir(bildablage)).toHaveLength(1);

    const bild = await GET(new Request("https://dev.wegfara.com/x"), {
      params: Promise.resolve({ tripId: SUEDITALIEN_ID }),
    });
    expect(bild.status).toBe(200);
    expect(Buffer.from(await bild.arrayBuffer()).toString()).toBe("mein-bild");
  });

  it("raeumt ein ersetztes eigenes Bild aus der Ablage", async () => {
    await angemeldet();
    await POST(hochladen("erstes"));
    await POST(hochladen("zweites"));

    expect(await readdir(bildablage)).toHaveLength(1);

    await PUT(waehlen(await fotoDerReise()));
    expect(await readdir(bildablage)).toHaveLength(0);
  });

  it("weist eine Datei ab, die kein Bild ist", async () => {
    await angemeldet();
    expect(
      (await POST(hochladen("pdf", "application/pdf", "plan.pdf"))).status,
    ).toBe(400);
    expect(await readdir(bildablage)).toHaveLength(0);
  });

  it("liefert ohne eigenes Bild keines aus", async () => {
    await angemeldet();
    const bild = await GET(new Request("https://dev.wegfara.com/x"), {
      params: Promise.resolve({ tripId: SUEDITALIEN_ID }),
    });
    expect(bild.status).toBe(404);
  });
});

describe("POST /api/reise-titelfoto/ki (req-103, req-072)", () => {
  function anfrage(): Request {
    return new Request("https://dev.wegfara.com/api/reise-titelfoto/ki", {
      method: "POST",
      body: JSON.stringify({ tripId: SUEDITALIEN_ID }),
    });
  }

  it("sagt ohne Zugangsschluessel, dass er fehlt", async () => {
    await angemeldet();

    const response = await POST_KI(anfrage());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: apiKeyMissingHint("ki_suche"),
    });
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
  });

  it("legt das erzeugte Bild als KI-Bild ab", async () => {
    await angemeldet();
    await storeAccountApiKey(
      testDb.pool,
      ACCOUNT_ID,
      "ki_suche",
      "sk-test-4711",
      new Date(),
    );
    const generateImage = vi.fn(async () => ({
      ok: true as const,
      bild: {
        data: new Uint8Array(Buffer.from("png")),
        contentType: "image/png",
      },
    }));
    aussen.createOpenAiClient.mockImplementation(
      () => ({ generateImage }) as unknown as AiClient,
    );

    const response = await POST_KI(anfrage());

    expect(response.status).toBe(201);
    expect(await titelfotoAus(response)).toMatchObject({
      art: "eigen",
      istKiBild: true,
    });
    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(await readdir(bildablage)).toHaveLength(1);
  });
});
