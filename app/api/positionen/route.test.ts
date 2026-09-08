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
const { setTripState } = await import("@/lib/db/trips");
const { setPositionSharing } = await import("@/lib/db/position-sharing");
const { saveTripPosition, listTripPositions } = await import(
  "@/lib/db/trip-positions"
);
const { GET, POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const PRAIANO = { lat: 40.6114, lng: 14.6896 };

function getAnfrage(tripId: string) {
  return new Request(
    `https://dev.wegfara.com/api/positionen?reise=${encodeURIComponent(tripId)}`,
  );
}

function postAnfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/positionen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Freigegeben und heute im Zeitraum -- Teilen ist grundsaetzlich erlaubt. */
async function freigegebeneReise(jetzt: Date) {
  const von = new Date(jetzt);
  von.setDate(von.getDate() - 1);
  const bis = new Date(jetzt);
  bis.setDate(bis.getDate() + 1);
  await testDb.pool.query(
    `update trip set start_date = $2, end_date = $3 where id = $1`,
    [SUEDITALIEN_ID, von, bis],
  );
  await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/positionen (req-050)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect(
      (await POST(postAnfrage({ tripId: SUEDITALIEN_ID, ...PRAIANO }))).status,
    ).toBe(401);
  });

  it("speichert nichts ohne eingeschaltete Freigabe", async () => {
    await angemeldet();
    await freigegebeneReise(new Date());

    const antwort = await POST(
      postAnfrage({ tripId: SUEDITALIEN_ID, ...PRAIANO }),
    );

    expect(await antwort.json()).toEqual({ gespeichert: false });
    expect(
      await listTripPositions(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID),
    ).toEqual([]);
  });

  it("speichert die Position bei eingeschalteter Freigabe und laufender Reise", async () => {
    await angemeldet();
    await freigegebeneReise(new Date());
    await setPositionSharing(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      new Date(),
    );

    const antwort = await POST(
      postAnfrage({ tripId: SUEDITALIEN_ID, ...PRAIANO }),
    );

    expect(await antwort.json()).toEqual({ gespeichert: true });
    const gespeichert = await listTripPositions(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(gespeichert).toHaveLength(1);
    expect(gespeichert[0]).toMatchObject(PRAIANO);
  });

  it("speichert nichts, solange die Reise in Planung ist", async () => {
    await angemeldet();
    await setPositionSharing(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      new Date(),
    );

    const antwort = await POST(
      postAnfrage({ tripId: SUEDITALIEN_ID, ...PRAIANO }),
    );

    expect(await antwort.json()).toEqual({ gespeichert: false });
  });

  it("speichert nichts, wenn der Zeitraum bereits vorbei ist", async () => {
    await angemeldet();
    const gestern = new Date();
    gestern.setDate(gestern.getDate() - 1);
    await testDb.pool.query(
      `update trip set start_date = $2, end_date = $2 where id = $1`,
      [SUEDITALIEN_ID, gestern],
    );
    await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");
    await setPositionSharing(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      new Date(),
    );

    const antwort = await POST(
      postAnfrage({ tripId: SUEDITALIEN_ID, ...PRAIANO }),
    );

    expect(await antwort.json()).toEqual({ gespeichert: false });
  });

  it("kennt keine Reise eines fremden Accounts", async () => {
    await angemeldet();

    expect(
      (await POST(postAnfrage({ tripId: crypto.randomUUID(), ...PRAIANO })))
        .status,
    ).toBe(404);
  });

  it("verlangt gueltige Koordinaten", async () => {
    await angemeldet();

    expect(
      (await POST(postAnfrage({ tripId: SUEDITALIEN_ID, lat: "40", lng: 14 })))
        .status,
    ).toBe(400);
  });
});

describe("GET /api/positionen (req-050)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET(getAnfrage(SUEDITALIEN_ID))).status).toBe(401);
  });

  it("nennt Namen und Koordinaten der geteilten Positionen", async () => {
    await angemeldet();
    await freigegebeneReise(new Date());
    await saveTripPosition(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      PRAIANO,
      new Date(),
    );

    const antwort = await (await GET(getAnfrage(SUEDITALIEN_ID))).json();

    expect(antwort.positionen).toHaveLength(1);
    expect(antwort.positionen[0]).toMatchObject({
      participantId: PARTICIPANT_ID,
      ...PRAIANO,
    });
    expect(typeof antwort.positionen[0].name).toBe("string");
  });

  it("laesst eine 16 Minuten alte Position nicht mehr erscheinen", async () => {
    await angemeldet();
    await freigegebeneReise(new Date());
    const vor16Minuten = new Date(Date.now() - 16 * 60_000);
    await saveTripPosition(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      PRAIANO,
      vor16Minuten,
    );

    const antwort = await (await GET(getAnfrage(SUEDITALIEN_ID))).json();

    expect(antwort.positionen).toEqual([]);
  });

  it("zeigt keine Positionen, solange die Reise in Planung ist", async () => {
    await angemeldet();
    await saveTripPosition(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      PRAIANO,
      new Date(),
    );

    const antwort = await (await GET(getAnfrage(SUEDITALIEN_ID))).json();

    expect(antwort.positionen).toEqual([]);
  });

  it("kennt keine Reise eines fremden Accounts", async () => {
    await angemeldet();

    expect((await GET(getAnfrage(crypto.randomUUID()))).status).toBe(404);
  });

  it("verlangt die Reise in der Anfrage", async () => {
    await angemeldet();

    expect((await GET(getAnfrage(""))).status).toBe(400);
  });
});
