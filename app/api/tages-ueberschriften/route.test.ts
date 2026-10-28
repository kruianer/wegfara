// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { AiClient } from "@/lib/ai/client";
import type { TagesUeberschrift } from "@/lib/druck/ueberschriften";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
/** OpenAI wird gemockt (stack.md, Testing). */
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
const { listActivities } = await import("@/lib/db/activities");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { apiKeyMissingHint } = await import("@/lib/api-keys/types");
const { POST, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

function anfrage(method: string, body: unknown): Request {
  return new Request("https://dev.wegfara.com/api/tages-ueberschriften", {
    method,
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

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

/** Die KI antwortet je gefragtem Tag mit einer Ueberschrift. */
function kiSchreibt(text = (datum: string) => `Ein Tag am ${datum}`) {
  const complete = vi.fn(async (prompt: string) => {
    const tage = JSON.parse(prompt.split("Die Tage:\n")[1]) as {
      datum: string;
    }[];
    return {
      ok: true as const,
      text: JSON.stringify({
        tage: tage.map((tag) => ({
          datum: tag.datum,
          ueberschrift: text(tag.datum),
        })),
      }),
    };
  });
  aussen.createOpenAiClient.mockImplementation(
    () => ({ complete }) as unknown as AiClient,
  );
  return complete;
}

async function tageMitProgramm(): Promise<string[]> {
  const activities = await listActivities(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
  );
  return [...new Set(activities.map((a) => a.startAt.slice(0, 10)))].sort();
}

async function ueberschriftenAus(
  response: Response,
): Promise<TagesUeberschrift[]> {
  return ((await response.json()) as { ueberschriften: TagesUeberschrift[] })
    .ueberschriften;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
});

afterEach(() => {
  aussen.createOpenAiClient.mockReset();
  vi.unstubAllEnvs();
});

describe("POST /api/tages-ueberschriften (req-103)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect(
      (await POST(anfrage("POST", { tripId: SUEDITALIEN_ID }))).status,
    ).toBe(401);
  });

  it("sagt ohne Zugangsschluessel, dass er fehlt, und fragt nicht", async () => {
    await angemeldet();

    const response = await POST(anfrage("POST", { tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: apiKeyMissingHint("ki_suche"),
    });
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
  });

  it("schreibt mit Zugangsschluessel je Tag eine Ueberschrift", async () => {
    await mitKiSchluessel();
    const complete = kiSchreibt();
    const tage = await tageMitProgramm();
    expect(tage.length).toBeGreaterThan(0);

    const response = await POST(anfrage("POST", { tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(200);
    expect((await ueberschriftenAus(response)).map((u) => u.datum)).toEqual(
      tage,
    );
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("laesst eine von Hand geaenderte Ueberschrift beim erneuten Erzeugen stehen", async () => {
    await mitKiSchluessel();
    kiSchreibt();
    const [erster] = await tageMitProgramm();
    await POST(anfrage("POST", { tripId: SUEDITALIEN_ID }));
    await PUT(
      anfrage("PUT", {
        tripId: SUEDITALIEN_ID,
        datum: erster,
        text: "Meine Überschrift",
      }),
    );

    kiSchreibt(() => "Neu von der KI");
    const response = await POST(anfrage("POST", { tripId: SUEDITALIEN_ID }));

    const liste = await ueberschriftenAus(response);
    expect(liste.find((u) => u.datum === erster)).toMatchObject({
      text: "Meine Überschrift",
      vonHand: true,
    });
    expect(
      liste
        .filter((u) => u.datum !== erster)
        .every((u) => u.text === "Neu von der KI"),
    ).toBe(true);
  });

  it("nennt den Grund, wenn die KI nichts Brauchbares liefert", async () => {
    await mitKiSchluessel();
    aussen.createOpenAiClient.mockImplementation(
      () =>
        ({
          complete: async () => ({ ok: true, text: "Keine Ahnung." }),
        }) as unknown as AiClient,
    );

    const response = await POST(anfrage("POST", { tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: string }).error).toBeTruthy();
  });
});

describe("PUT /api/tages-ueberschriften (req-103)", () => {
  it("weist eine zu lange Ueberschrift ab", async () => {
    await angemeldet();
    const response = await PUT(
      anfrage("PUT", {
        tripId: SUEDITALIEN_ID,
        datum: "2026-07-19",
        text: "x".repeat(61),
      }),
    );
    expect(response.status).toBe(400);
  });
});
