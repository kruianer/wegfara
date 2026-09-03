// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
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
const { listSearchAreas, setSearchArea } = await import("@/lib/db/search-area");
const { DELETE, POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const FLAECHE = [
  { lat: 40.8, lng: 14.2 },
  { lat: 40.8, lng: 14.4 },
  { lat: 41.0, lng: 14.4 },
];

function anfrage(body: unknown, method: "POST" | "DELETE" = "POST") {
  return new Request("https://dev.wegfara.com/api/search-area", {
    method,
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Ein zweiter Account mit eigener Reise. */
async function fremdeReise(): Promise<{ accountId: string; tripId: string }> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  await testDb.pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await testDb.pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  return { accountId, tripId };
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/search-area (req-024)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, points: FLAECHE }),
    );

    expect(response.status).toBe(401);
    expect(await listSearchAreas(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("speichert das Suchgebiet einer Reise des eigenen Accounts", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, points: FLAECHE }),
    );

    expect(response.status).toBe(200);
    expect(await listSearchAreas(testDb.pool, ACCOUNT_ID)).toEqual([
      { tripId: SUEDITALIEN_ID, points: FLAECHE },
    ]);
  });

  it("zeichnet nichts in eine Reise eines anderen Accounts", async () => {
    await angemeldet();
    const fremd = await fremdeReise();

    const response = await POST(
      anfrage({ tripId: fremd.tripId, points: FLAECHE }),
    );

    expect(response.status).toBe(404);
    expect(await listSearchAreas(testDb.pool, fremd.accountId)).toEqual([]);
  });
});

describe("DELETE /api/search-area (req-024)", () => {
  it("verlangt eine Anmeldung", async () => {
    await setSearchArea(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, FLAECHE);

    const response = await DELETE(
      anfrage({ tripId: SUEDITALIEN_ID }, "DELETE"),
    );

    expect(response.status).toBe(401);
    expect(await listSearchAreas(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("entfernt kein Suchgebiet eines anderen Accounts", async () => {
    await angemeldet();
    const fremd = await fremdeReise();
    await setSearchArea(testDb.pool, fremd.accountId, fremd.tripId, FLAECHE);

    const response = await DELETE(anfrage({ tripId: fremd.tripId }, "DELETE"));

    expect(response.status).toBe(404);
    expect(await listSearchAreas(testDb.pool, fremd.accountId)).toHaveLength(1);
  });
});
