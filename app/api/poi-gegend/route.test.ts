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
const { listPois } = await import("@/lib/db/pois");
const { POST } = await import("./route");

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/poi-gegend", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
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

async function gegendVon(poiId: string): Promise<string | null> {
  const { rows } = await testDb.pool.query(
    `select gegend from poi where id = $1`,
    [poiId],
  );
  return (rows[0] as { gegend: string | null }).gegend;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

/** Dieselbe Gegend fuer mehrere angekreuzte POIs (req-098). */
describe("POST /api/poi-gegend (req-098)", () => {
  it("verlangt eine Anmeldung", async () => {
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const ids = pois.slice(0, 2).map((poi) => poi.id);

    const response = await POST(anfrage({ poiIds: ids, gegend: "BIO" }));

    expect(response.status).toBe(401);
    for (const id of ids) expect(await gegendVon(id)).toBeNull();
  });

  it("gibt sechs angekreuzten POIs dieselbe Gegend", async () => {
    await angemeldet();
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const ids = pois.slice(0, 6).map((poi) => poi.id);

    const response = await POST(anfrage({ poiIds: ids, gegend: "BIO" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", updatedIds: ids });
    for (const id of ids) expect(await gegendVon(id)).toBe("BIO");
  });

  it("nimmt mit null die Gegend wieder weg", async () => {
    await angemeldet();
    const [poi] = await listPois(testDb.pool, ACCOUNT_ID);
    await POST(anfrage({ poiIds: [poi.id], gegend: "BIO" }));

    const response = await POST(anfrage({ poiIds: [poi.id], gegend: null }));

    expect(response.status).toBe(200);
    expect(await gegendVon(poi.id)).toBeNull();
  });

  it("weist eine Anfrage ohne POIs oder ohne Gegend ab", async () => {
    await angemeldet();
    const [poi] = await listPois(testDb.pool, ACCOUNT_ID);

    expect((await POST(anfrage({ poiIds: [], gegend: "BIO" }))).status).toBe(
      400,
    );
    expect((await POST(anfrage({ poiIds: [poi.id] }))).status).toBe(400);
    expect((await POST(anfrage({ poiIds: [poi.id], gegend: 7 }))).status).toBe(
      400,
    );
  });

  it("aendert keinen POI eines anderen Accounts", async () => {
    await angemeldet();
    const poiId = await fremderPoi();

    const response = await POST(anfrage({ poiIds: [poiId], gegend: "BIO" }));

    expect(response.status).toBe(404);
    expect(await gegendVon(poiId)).toBeNull();
  });
});
