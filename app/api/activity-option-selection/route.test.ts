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
const { listActivityOptionSelections } = await import(
  "@/lib/db/activity-option-selections"
);
const { POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const GRUPPE_START = "2026-07-21T13:30";
const GRUPPE_ENDE = "2026-07-21T15:00";
const VESUV_ID = "1a2b3c4d-0002-4a11-8b11-9f1c2d3e4f02";

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/activity-option-selection", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Ein zweiter Account mit eigener Reise und eigenem Programmpunkt. */
async function fremdeReise(): Promise<{
  accountId: string;
  tripId: string;
  activityId: string;
}> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const activityId = randomUUID();
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
    `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
     values ($1, $2, 'restaurant', 'Fremder Programmpunkt', 'kurz', 'lang', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
    [activityId, tripId],
  );
  return { accountId, tripId, activityId };
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/activity-option-selection (req-024)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(
      anfrage({
        tripId: SUEDITALIEN_ID,
        startAt: GRUPPE_START,
        endAt: GRUPPE_ENDE,
        activityId: VESUV_ID,
      }),
    );

    expect(response.status).toBe(401);
    expect(await listActivityOptionSelections(testDb.pool, ACCOUNT_ID)).toEqual(
      {},
    );
  });

  it("speichert die Wahl in einer Reise des eigenen Accounts", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({
        tripId: SUEDITALIEN_ID,
        startAt: GRUPPE_START,
        endAt: GRUPPE_ENDE,
        activityId: VESUV_ID,
      }),
    );

    expect(response.status).toBe(200);
    const selections = await listActivityOptionSelections(
      testDb.pool,
      ACCOUNT_ID,
    );
    expect(selections[`${SUEDITALIEN_ID}|${GRUPPE_START}|${GRUPPE_ENDE}`]).toBe(
      VESUV_ID,
    );
  });

  it("waehlt nichts in einer Reise eines anderen Accounts", async () => {
    await angemeldet();
    const fremd = await fremdeReise();

    const response = await POST(
      anfrage({
        tripId: fremd.tripId,
        startAt: "2027-01-01T10:00",
        endAt: "2027-01-01T11:00",
        activityId: fremd.activityId,
      }),
    );

    expect(response.status).toBe(404);
    expect(
      await listActivityOptionSelections(testDb.pool, fremd.accountId),
    ).toEqual({});
  });
});
