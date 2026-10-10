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
const { listActivities } = await import("@/lib/db/activities");
const { POST } = await import("./route");

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/programmpunkt-druck", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Irgendein Programmpunkt des eigenen Accounts. */
async function eigenerProgrammpunkt(): Promise<string> {
  const activities = await listActivities(testDb.pool, ACCOUNT_ID);
  return activities[0].id;
}

/** Ein zweiter Account mit eigener Reise und eigenem Programmpunkt. */
async function fremderProgrammpunkt(): Promise<string> {
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
     values ($1, $2, 'restaurant', 'Fremder Programmpunkt', '', '', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
    [activityId, tripId],
  );
  return activityId;
}

async function darstellungVon(activityId: string): Promise<string> {
  const { rows } = await testDb.pool.query(
    "select druck_darstellung from activity where id = $1",
    [activityId],
  );
  return rows[0].druck_darstellung as string;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/programmpunkt-druck (req-080)", () => {
  it("setzt das Kennzeichen eines Programmpunkts", async () => {
    await angemeldet();
    const activityId = await eigenerProgrammpunkt();

    const response = await POST(
      anfrage({ activityId, darstellung: "nebenstation" }),
    );

    expect(response.status).toBe(200);
    expect(await darstellungVon(activityId)).toBe("nebenstation");
  });

  it("gibt den geaenderten Programmpunkt zurueck", async () => {
    await angemeldet();
    const activityId = await eigenerProgrammpunkt();

    const response = await POST(
      anfrage({ activityId, darstellung: "nicht_anzeigen" }),
    );

    const payload = (await response.json()) as {
      activity?: { id: string; druckDarstellung: string };
    };
    expect(payload.activity).toMatchObject({
      id: activityId,
      druckDarstellung: "nicht_anzeigen",
    });
  });

  it("weist ohne Anmeldung ab (req-016)", async () => {
    const activityId = await eigenerProgrammpunkt();

    const response = await POST(
      anfrage({ activityId, darstellung: "nebenstation" }),
    );

    expect(response.status).toBe(401);
    expect(await darstellungVon(activityId)).toBe("vollstaendig");
  });

  it("weist ein unbekanntes Kennzeichen ab", async () => {
    await angemeldet();
    const activityId = await eigenerProgrammpunkt();

    const response = await POST(anfrage({ activityId, darstellung: "gross" }));

    expect(response.status).toBe(400);
    expect(await darstellungVon(activityId)).toBe("vollstaendig");
  });

  it("weist eine Anfrage ohne Programmpunkt ab", async () => {
    await angemeldet();

    const response = await POST(anfrage({ darstellung: "nebenstation" }));

    expect(response.status).toBe(400);
  });

  it("ruehrt den Programmpunkt eines anderen Accounts nicht an (req-024)", async () => {
    await angemeldet();
    const activityId = await fremderProgrammpunkt();

    const response = await POST(
      anfrage({ activityId, darstellung: "nicht_anzeigen" }),
    );

    expect(response.status).toBe(404);
    expect(await darstellungVon(activityId)).toBe("vollstaendig");
  });
});
