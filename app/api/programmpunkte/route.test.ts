// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Activity } from "@/lib/activities/types";

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
const { POST, PATCH, DELETE } = await import("./route");

/** Die Sueditalien Rundreise der Demodaten (18.07. bis 23.07.2026). */
const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
/** "Ausgrabungsstätte Pompeji", Typ Sehenswuerdigkeit, Status "Gesetzt". */
const POMPEJI_POI_ID = "462f6811-13cc-4247-99aa-8b9693955ab7";
/** "Villa Rufolo", Typ Sehenswuerdigkeit, Status "Weiß noch nicht". */
const VILLA_RUFOLO_POI_ID = "b6652937-9196-4a63-ab17-5edfdda66642";

function anfrage(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  return new Request("https://dev.wegfara.com/api/programmpunkte", {
    method,
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function statusSetzen(poiId: string, status: string) {
  await testDb.pool.query(`update poi set status = $2 where id = $1`, [
    poiId,
    status,
  ]);
}

async function activityAus(response: Response): Promise<Activity> {
  return ((await response.json()) as { activity: Activity }).activity;
}

/** Ein zweiter Account mit eigener Reise und eigenem POI. */
async function fremderPoi(): Promise<{ poiId: string; tripId: string }> {
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
     values ($1, $2, 1, 'Fremder POI', 'Berlin', 'sehenswuerdigkeit', 52.52, 13.405, 'gesetzt')`,
    [poiId, tripId],
  );
  return { poiId, tripId };
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/programmpunkte (req-039)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(
      anfrage("POST", { poiId: POMPEJI_POI_ID, startAt: "2026-07-20T10:00" }),
    );

    expect(response.status).toBe(401);
  });

  it("legt den Programmpunkt zum verplanten POI an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", { poiId: POMPEJI_POI_ID, startAt: "2026-07-20T10:00" }),
    );

    expect(response.status).toBe(201);
    expect(await activityAus(response)).toMatchObject({
      tripId: SUEDITALIEN_ID,
      poiId: POMPEJI_POI_ID,
      title: "Ausgrabungsstätte Pompeji",
      type: "sehenswuerdigkeit",
      startAt: "2026-07-20T10:00",
      // Geschaetzte Dauer einer Sehenswuerdigkeit: 2,5 h (req-011).
      endAt: "2026-07-20T12:30",
      shortText: "",
      longText: "",
    });
  });

  it("rastet die Startzeit auf 15 Minuten ein", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", { poiId: POMPEJI_POI_ID, startAt: "2026-07-20T10:11" }),
    );

    expect(await activityAus(response)).toMatchObject({
      startAt: "2026-07-20T10:00",
      endAt: "2026-07-20T12:30",
    });
  });

  it("laesst den Status des POI unveraendert (req-039)", async () => {
    await angemeldet();
    await statusSetzen(POMPEJI_POI_ID, "wahrscheinlich");

    await POST(
      anfrage("POST", { poiId: POMPEJI_POI_ID, startAt: "2026-07-20T10:00" }),
    );

    const { rows } = await testDb.pool.query(
      `select status from poi where id = $1`,
      [POMPEJI_POI_ID],
    );
    expect((rows[0] as { status: string }).status).toBe("wahrscheinlich");
  });

  it('verplant keinen POI mit Status "Weiß noch nicht"', async () => {
    await angemeldet();
    const vorher = await listActivities(testDb.pool, ACCOUNT_ID);

    const response = await POST(
      anfrage("POST", {
        poiId: VILLA_RUFOLO_POI_ID,
        startAt: "2026-07-20T10:00",
      }),
    );

    expect(response.status).toBe(400);
    const nachher = await listActivities(testDb.pool, ACCOUNT_ID);
    expect(nachher).toHaveLength(vorher.length);
  });

  it("legt ausserhalb des Reisezeitraums keinen Programmpunkt an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", { poiId: POMPEJI_POI_ID, startAt: "2026-07-24T10:00" }),
    );

    expect(response.status).toBe(400);
    const activities = await listActivities(testDb.pool, ACCOUNT_ID);
    expect(activities.some((a) => a.startAt.startsWith("2026-07-24"))).toBe(
      false,
    );
  });

  it("verplant keinen POI eines anderen Accounts (req-024)", async () => {
    await angemeldet();
    const { poiId, tripId } = await fremderPoi();

    const response = await POST(
      anfrage("POST", { poiId, startAt: "2027-01-02T10:00" }),
    );

    expect(response.status).toBe(404);
    const { rows } = await testDb.pool.query(
      "select id from activity where trip_id = $1",
      [tripId],
    );
    expect(rows).toHaveLength(0);
  });

  it("weist eine unbrauchbare Anfrage ab", async () => {
    await angemeldet();

    expect((await POST(anfrage("POST", {}))).status).toBe(400);
    expect(
      (await POST(anfrage("POST", { poiId: POMPEJI_POI_ID }))).status,
    ).toBe(400);
  });
});

describe("PATCH /api/programmpunkte (req-040)", () => {
  /** Der Programmpunkt der Akzeptanzkriterien: 20.07., 10:00 bis 12:30. */
  async function verplant(): Promise<Activity> {
    return activityAus(
      await POST(
        anfrage("POST", { poiId: POMPEJI_POI_ID, startAt: "2026-07-20T10:00" }),
      ),
    );
  }

  async function gespeichert(id: string): Promise<Activity | undefined> {
    return (await listActivities(testDb.pool, ACCOUNT_ID)).find(
      (a) => a.id === id,
    );
  }

  it("verlangt eine Anmeldung", async () => {
    await angemeldet();
    const activity = await verplant();
    cookieJar.werte = {};

    const response = await PATCH(
      anfrage("PATCH", { id: activity.id, startAt: "2026-07-20T14:00" }),
    );

    expect(response.status).toBe(401);
    expect(await gespeichert(activity.id)).toMatchObject({
      startAt: "2026-07-20T10:00",
    });
  });

  it("verschiebt den Programmpunkt und behaelt seine Dauer", async () => {
    await angemeldet();
    const activity = await verplant();

    const response = await PATCH(
      anfrage("PATCH", { id: activity.id, startAt: "2026-07-20T14:00" }),
    );

    expect(response.status).toBe(200);
    expect(await activityAus(response)).toMatchObject({
      id: activity.id,
      startAt: "2026-07-20T14:00",
      endAt: "2026-07-20T16:30",
    });
  });

  it("nimmt ihn auf einen anderen Reisetag mit, zur selben Uhrzeit", async () => {
    await angemeldet();
    const activity = await verplant();

    const response = await PATCH(
      anfrage("PATCH", { id: activity.id, startAt: "2026-07-21T10:00" }),
    );

    expect(await activityAus(response)).toMatchObject({
      startAt: "2026-07-21T10:00",
      endAt: "2026-07-21T12:30",
    });
  });

  it("zieht den unteren Rand auf ein neues Ende", async () => {
    await angemeldet();
    const activity = await verplant();

    const response = await PATCH(
      anfrage("PATCH", { id: activity.id, endAt: "2026-07-20T14:00" }),
    );

    expect(await activityAus(response)).toMatchObject({
      startAt: "2026-07-20T10:00",
      endAt: "2026-07-20T14:00",
    });
  });

  it("laesst ihn nicht kuerzer als 15 Minuten werden", async () => {
    await angemeldet();
    const activity = await verplant();

    const response = await PATCH(
      anfrage("PATCH", { id: activity.id, endAt: "2026-07-20T09:00" }),
    );

    expect(await activityAus(response)).toMatchObject({
      startAt: "2026-07-20T10:00",
      endAt: "2026-07-20T10:15",
    });
  });

  it("bleibt gespeichert -- auch beim naechsten Laden", async () => {
    await angemeldet();
    const activity = await verplant();

    await PATCH(
      anfrage("PATCH", { id: activity.id, startAt: "2026-07-22T14:11" }),
    );

    // Und rastet dabei auf 15 Minuten ein.
    expect(await gespeichert(activity.id)).toMatchObject({
      startAt: "2026-07-22T14:00",
      endAt: "2026-07-22T16:30",
    });
  });

  it("verschiebt ihn nicht auf einen Tag ausserhalb des Reisezeitraums", async () => {
    await angemeldet();
    const activity = await verplant();

    const response = await PATCH(
      anfrage("PATCH", { id: activity.id, startAt: "2026-07-24T10:00" }),
    );

    expect(response.status).toBe(400);
    expect(await gespeichert(activity.id)).toMatchObject({
      startAt: "2026-07-20T10:00",
    });
  });

  it("nimmt eine Ueberlappung an, statt sie abzulehnen (req-039)", async () => {
    await angemeldet();
    const activity = await verplant();
    // "Dom von Amalfi" liegt am 18.07. von 10:00 bis 12:30 (Demodaten).
    const response = await PATCH(
      anfrage("PATCH", { id: activity.id, startAt: "2026-07-18T10:00" }),
    );

    expect(response.status).toBe(200);
    const amGleichenTag = (
      await listActivities(testDb.pool, ACCOUNT_ID)
    ).filter((a) => a.startAt === "2026-07-18T10:00");
    expect(amGleichenTag.length).toBeGreaterThan(1);
  });

  it("verschiebt keinen Programmpunkt eines anderen Accounts (req-024)", async () => {
    await angemeldet();
    const { tripId } = await fremderPoi();
    const activityId = randomUUID();
    await testDb.pool.query(
      `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt', '', '', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [activityId, tripId],
    );

    const response = await PATCH(
      anfrage("PATCH", { id: activityId, startAt: "2027-01-02T10:00" }),
    );

    expect(response.status).toBe(404);
    const { rows } = await testDb.pool.query(
      "select start_at from activity where id = $1",
      [activityId],
    );
    expect(String((rows[0] as { start_at: unknown }).start_at)).toContain(
      "2027",
    );
  });

  it("weist eine unbrauchbare Anfrage ab", async () => {
    await angemeldet();
    const activity = await verplant();

    expect((await PATCH(anfrage("PATCH", {}))).status).toBe(400);
    expect((await PATCH(anfrage("PATCH", { id: activity.id }))).status).toBe(
      400,
    );
    expect(
      (await PATCH(anfrage("PATCH", { id: activity.id, startAt: "morgen" })))
        .status,
    ).toBe(400);
  });
});

describe("DELETE /api/programmpunkte (req-039)", () => {
  async function verplant(): Promise<Activity> {
    return activityAus(
      await POST(
        anfrage("POST", { poiId: POMPEJI_POI_ID, startAt: "2026-07-20T10:00" }),
      ),
    );
  }

  it("verlangt eine Anmeldung", async () => {
    await angemeldet();
    const activity = await verplant();
    cookieJar.werte = {};

    const response = await DELETE(anfrage("DELETE", { id: activity.id }));

    expect(response.status).toBe(401);
    const activities = await listActivities(testDb.pool, ACCOUNT_ID);
    expect(activities.some((a) => a.id === activity.id)).toBe(true);
  });

  it("entfernt den Programmpunkt und nennt seinen POI", async () => {
    await angemeldet();
    const activity = await verplant();

    const response = await DELETE(anfrage("DELETE", { id: activity.id }));

    expect(response.status).toBe(200);
    expect(await activityAus(response)).toMatchObject({
      id: activity.id,
      poiId: POMPEJI_POI_ID,
    });
    const activities = await listActivities(testDb.pool, ACCOUNT_ID);
    expect(activities.some((a) => a.id === activity.id)).toBe(false);
  });

  it("entfernt keinen Programmpunkt eines anderen Accounts (req-024)", async () => {
    await angemeldet();
    const { tripId } = await fremderPoi();
    const activityId = randomUUID();
    await testDb.pool.query(
      `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt', '', '', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [activityId, tripId],
    );

    const response = await DELETE(anfrage("DELETE", { id: activityId }));

    expect(response.status).toBe(404);
    const { rows } = await testDb.pool.query(
      "select id from activity where id = $1",
      [activityId],
    );
    expect(rows).toHaveLength(1);
  });
});
