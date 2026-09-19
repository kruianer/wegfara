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
  return new Request("https://dev.wegfara.com/api/poi-status", {
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

async function statusVon(poiId: string): Promise<string> {
  const { rows } = await testDb.pool.query(
    `select status from poi where id = $1`,
    [poiId],
  );
  return (rows[0] as { status: string }).status;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/poi-status (req-024)", () => {
  it("verlangt eine Anmeldung", async () => {
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const poi = pois[0];

    const response = await POST(anfrage({ poiId: poi.id, status: "gesetzt" }));

    expect(response.status).toBe(401);
    expect(await statusVon(poi.id)).toBe(poi.status);
  });

  it("setzt den Status eines POI des eigenen Accounts", async () => {
    await angemeldet();
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const poi = pois.find((p) => p.status !== "gesetzt")!;

    const response = await POST(anfrage({ poiId: poi.id, status: "gesetzt" }));

    expect(response.status).toBe(200);
    expect(await statusVon(poi.id)).toBe("gesetzt");
  });

  it("aendert keinen POI eines anderen Accounts", async () => {
    await angemeldet();
    const poiId = await fremderPoi();

    const response = await POST(anfrage({ poiId, status: "gesetzt" }));

    expect(response.status).toBe(404);
    expect(await statusVon(poiId)).toBe("weiss_nicht");
  });
});

/**
 * Derselbe Status fuer mehrere angekreuzte POIs auf einmal (req-069). Es ist
 * dieselbe Schnittstelle wie fuer den einzelnen POI -- und damit dasselbe
 * Recht: wer einen setzen darf, darf auch mehrere.
 */
describe("POST /api/poi-status — mehrere POIs auf einmal (req-069)", () => {
  it("verlangt auch fuer mehrere eine Anmeldung", async () => {
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const ids = pois.slice(0, 3).map((poi) => poi.id);

    const response = await POST(anfrage({ poiIds: ids, status: "gesetzt" }));

    expect(response.status).toBe(401);
    for (const poi of pois.slice(0, 3)) {
      expect(await statusVon(poi.id)).toBe(poi.status);
    }
  });

  it("setzt denselben Status fuer alle genannten POIs", async () => {
    await angemeldet();
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const drei = pois.slice(0, 3);

    const response = await POST(
      anfrage({ poiIds: drei.map((poi) => poi.id), status: "gesetzt" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      updatedIds: drei.map((poi) => poi.id),
    });
    for (const poi of drei) expect(await statusVon(poi.id)).toBe("gesetzt");
  });

  it("laesst die uebrigen POIs unveraendert", async () => {
    await angemeldet();
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    const drei = pois.slice(0, 3);
    const uebrige = pois.slice(3);
    expect(uebrige.length).toBeGreaterThan(0);

    await POST(
      anfrage({ poiIds: drei.map((poi) => poi.id), status: "gesetzt" }),
    );

    for (const poi of uebrige) expect(await statusVon(poi.id)).toBe(poi.status);
  });

  it("uebergeht POIs eines anderen Accounts und setzt die eigenen", async () => {
    await angemeldet();
    const eigener = (await listPois(testDb.pool, ACCOUNT_ID)).find(
      (poi) => poi.status !== "gesetzt",
    )!;
    const fremder = await fremderPoi();

    const response = await POST(
      anfrage({ poiIds: [eigener.id, fremder], status: "gesetzt" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      updatedIds: [eigener.id],
    });
    expect(await statusVon(eigener.id)).toBe("gesetzt");
    expect(await statusVon(fremder)).toBe("weiss_nicht");
  });

  it("weist eine leere Liste ab", async () => {
    await angemeldet();

    const response = await POST(anfrage({ poiIds: [], status: "gesetzt" }));

    expect(response.status).toBe(400);
  });

  it("weist einen unbekannten Status ab", async () => {
    await angemeldet();
    const pois = await listPois(testDb.pool, ACCOUNT_ID);

    const response = await POST(
      anfrage({ poiIds: [pois[0].id], status: "vielleicht" }),
    );

    expect(response.status).toBe(400);
    expect(await statusVon(pois[0].id)).toBe(pois[0].status);
  });
});
