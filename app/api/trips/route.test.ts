// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { ACCOUNT_ID } from "@/lib/account";
import type { Trip } from "@/lib/trips/types";

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
const { listTrips } = await import("@/lib/db/trips");
const { DELETE, POST, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const TOSKANA = {
  title: "Toskana 2027",
  startDate: "2027-05-12",
  endDate: "2027-05-19",
  mainPlace: { name: "Florenz", lat: 43.7696, lng: 11.2558 },
};

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/trips", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/trips (req-017)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(anfrage(TOSKANA))).status).toBe(401);
  });

  it("legt die Reise an und liefert sie zurueck", async () => {
    await angemeldet();

    const response = await POST(anfrage(TOSKANA));

    expect(response.status).toBe(201);
    const { trip } = (await response.json()) as { trip: Trip };
    expect(trip).toMatchObject(TOSKANA);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(4);
  });

  it("legt ohne Titel nichts an und benennt die Stelle", async () => {
    await angemeldet();

    const response = await POST(anfrage({ ...TOSKANA, title: "  " }));

    expect(response.status).toBe(400);
    const { errors } = (await response.json()) as {
      errors: Record<string, string>;
    };
    expect(errors.title).toBeDefined();
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });

  it("legt bei einem Ende vor dem Beginn nichts an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...TOSKANA, startDate: "2027-05-12", endDate: "2027-05-05" }),
    );

    expect(response.status).toBe(400);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });

  it("legt ohne Hauptort nichts an", async () => {
    await angemeldet();

    const response = await POST(anfrage({ ...TOSKANA, mainPlace: null }));

    expect(response.status).toBe(400);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });

  it("weist von Hand mitgeschickte, unbrauchbare Koordinaten ab", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...TOSKANA, mainPlace: { name: "Florenz", lat: "43,77" } }),
    );

    expect(response.status).toBe(400);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });
});

describe("PUT /api/trips (req-017)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect(
      (await PUT(anfrage({ id: SUEDITALIEN_ID, ...TOSKANA }))).status,
    ).toBe(401);
  });

  it("korrigiert den Titel der Reise", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        id: SUEDITALIEN_ID,
        ...TOSKANA,
        title: "Toskana Frühling 2027",
      }),
    );

    expect(response.status).toBe(200);
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)?.title).toBe(
      "Toskana Frühling 2027",
    );
  });

  it("speichert unzulaessige Eingaben nicht", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({ id: SUEDITALIEN_ID, ...TOSKANA, title: "" }),
    );

    expect(response.status).toBe(400);
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)?.title).toBe(
      "Süditalien Rundreise",
    );
  });

  it("kennt keine Reise eines anderen Accounts", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({ id: "3b8f2c1e-0000-4000-8000-000000000000", ...TOSKANA }),
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/trips (req-017)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await DELETE(anfrage({ id: SUEDITALIEN_ID }))).status).toBe(401);
  });

  it("entfernt die Reise samt aller daran haengenden Daten", async () => {
    await angemeldet();

    const response = await DELETE(anfrage({ id: SUEDITALIEN_ID }));

    expect(response.status).toBe(200);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(2);
    const { rows } = await testDb.pool.query(
      "select id from poi where trip_id = $1",
      [SUEDITALIEN_ID],
    );
    expect(rows).toHaveLength(0);
  });

  it("kennt keine Reise eines anderen Accounts", async () => {
    await angemeldet();

    const response = await DELETE(
      anfrage({ id: "3b8f2c1e-0000-4000-8000-000000000000" }),
    );

    expect(response.status).toBe(404);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });
});
