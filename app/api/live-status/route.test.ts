// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
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
const { saveTripPosition } = await import("@/lib/db/trip-positions");
const { setTripState } = await import("@/lib/db/trips");
const { createActivity } = await import("@/lib/db/activities");
const { clearOrtCache } = await import("@/lib/live-status/ort-cache");
const { GET } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

/** Der Ort, an dem der laufende Programmpunkt stattfindet. */
const POSITANO = { lat: 40.6281, lng: 14.4842 };
/** Wo die Gruppe tatsaechlich ist. */
const PRAIANO = { lat: 40.6114, lng: 14.6896 };

function anfrage(tripId: string) {
  return new Request(
    `https://dev.wegfara.com/api/live-status?reise=${encodeURIComponent(tripId)}`,
  );
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/**
 * Eine laufende Reise: freigegeben, heute im Zeitraum, mit einem
 * Programmpunkt, der gerade laeuft.
 */
async function laufendeReise(jetzt: Date) {
  const heute = new Date(jetzt);
  const von = new Date(heute);
  von.setDate(von.getDate() - 1);
  const bis = new Date(heute);
  bis.setDate(bis.getDate() + 1);

  await testDb.pool.query(
    `update trip set start_date = $2, end_date = $3 where id = $1`,
    [SUEDITALIEN_ID, von, bis],
  );
  await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

  const beginn = new Date(jetzt.getTime() - 30 * 60_000);
  const ende = new Date(jetzt.getTime() + 30 * 60_000);
  await createActivity(testDb.pool, ACCOUNT_ID, {
    tripId: SUEDITALIEN_ID,
    poiId: null,
    type: "restaurant",
    title: "Mittagessen Positano",
    shortText: "",
    longText: "",
    startAt: lokal(beginn),
    endAt: lokal(ende),
    position: POSITANO,
  });
}

function lokal(date: Date): string {
  const teil = (wert: number) => String(wert).padStart(2, "0");
  return (
    `${date.getFullYear()}-${teil(date.getMonth() + 1)}-${teil(date.getDate())}` +
    `T${teil(date.getHours())}:${teil(date.getMinutes())}`
  );
}

/** OSRM und Nominatim antworten aus dem Haus -- kein Netz im Test. */
function externeDienste({
  fahrzeitMinuten,
}: {
  fahrzeitMinuten: number | null;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("nominatim")) {
        return new Response(
          JSON.stringify({ address: { village: "Praiano" } }),
          { status: 200 },
        );
      }
      if (fahrzeitMinuten === null) throw new Error("network down");
      return new Response(
        JSON.stringify({
          code: "Ok",
          routes: [{ duration: fahrzeitMinuten * 60 }],
        }),
        { status: 200 },
      );
    }),
  );
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  clearOrtCache();
  vi.unstubAllGlobals();
});

describe("GET /api/live-status (req-051)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET(anfrage(SUEDITALIEN_ID))).status).toBe(401);
  });

  it("kennt keine Reise eines fremden Accounts", async () => {
    await angemeldet();

    expect((await GET(anfrage(crypto.randomUUID()))).status).toBe(404);
  });

  it("nennt Ort und Verzug zur geteilten Position", async () => {
    const jetzt = new Date();
    await angemeldet();
    await laufendeReise(jetzt);
    await saveTripPosition(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { ...PRAIANO, ort: "Praiano" },
      jetzt,
    );
    externeDienste({ fahrzeitMinuten: 25 });

    const antwort = await (await GET(anfrage(SUEDITALIEN_ID))).json();

    expect(antwort).toEqual({
      ort: "Praiano",
      verzug: { art: "verspaetet", minuten: 25 },
    });
  });

  it("meldet den Verzug als unbekannt, wenn OSRM nicht erreichbar ist", async () => {
    const jetzt = new Date();
    await angemeldet();
    await laufendeReise(jetzt);
    await saveTripPosition(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { ...PRAIANO, ort: "Praiano" },
      jetzt,
    );
    externeDienste({ fahrzeitMinuten: null });

    const antwort = await (await GET(anfrage(SUEDITALIEN_ID))).json();

    expect(antwort).toEqual({ ort: "Praiano", verzug: { art: "unbekannt" } });
  });

  it("hat ohne geteilte Position weder Ort noch Verzug", async () => {
    const jetzt = new Date();
    await angemeldet();
    await laufendeReise(jetzt);
    externeDienste({ fahrzeitMinuten: 25 });

    const antwort = await (await GET(anfrage(SUEDITALIEN_ID))).json();

    expect(antwort).toEqual({ ort: null, verzug: { art: "keiner" } });
  });

  it("gibt keine Position heraus, solange die Reise in Planung ist", async () => {
    const jetzt = new Date();
    await angemeldet();
    await laufendeReise(jetzt);
    await saveTripPosition(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { ...PRAIANO, ort: "Praiano" },
      jetzt,
    );
    await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "in_planung");
    externeDienste({ fahrzeitMinuten: 25 });

    const antwort = await (await GET(anfrage(SUEDITALIEN_ID))).json();

    expect(antwort).toEqual({ ort: null, verzug: { art: "keiner" } });
  });

  it("verlangt die Reise in der Anfrage", async () => {
    await angemeldet();

    expect((await GET(anfrage(""))).status).toBe(400);
  });
});
