// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Transfer } from "@/lib/transfers/types";

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
const { listTransfers } = await import("@/lib/db/transfers");
const { POST, PATCH, DELETE } = await import("./route");

/** Zwei Programmpunkte des 21.07. der Sueditalien-Rundreise, ohne Transfer. */
const POMPEJI_ID = "58ccb947-6c2e-4b18-a9cc-47461e47140d";
const SORRENT_ID = "7052adca-7b5f-4a16-85bd-ca0f4513566e";
const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
/** "Fahrt zum Aussichtspunkt" aus den Demodaten (req-006). */
const VORHANDENER_TRANSFER_ID = "4879b2a4-d673-4d70-97c2-f5d0cb505f04";

const ANGABEN = {
  mode: "auto",
  title: "Fahrt nach Sorrent",
  durationMin: 45,
  distanceKm: 30.5,
};

function anfrage(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  return new Request("https://dev.wegfara.com/api/transfers", {
    method,
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function transferAus(response: Response): Promise<Transfer> {
  return ((await response.json()) as { transfer: Transfer }).transfer;
}

/** Ein zweiter Account mit eigener Reise und zwei eigenen Programmpunkten. */
async function fremdeProgrammpunkte(): Promise<[string, string]> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const ids: [string, string] = [randomUUID(), randomUUID()];
  await testDb.pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await testDb.pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  for (const [index, id] of ids.entries()) {
    await testDb.pool.query(
      `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt', 'kurz', 'lang', $3, $4, 52.52, 13.405)`,
      [id, tripId, `2027-01-01 1${index}:00`, `2027-01-01 1${index}:30`],
    );
  }
  return ids;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/transfers (req-052)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(
      anfrage("POST", {
        ...ANGABEN,
        fromActivityId: POMPEJI_ID,
        toActivityId: SORRENT_ID,
      }),
    );

    expect(response.status).toBe(401);
  });

  it("legt den Transfer zwischen zwei Programmpunkten an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", {
        ...ANGABEN,
        fromActivityId: POMPEJI_ID,
        toActivityId: SORRENT_ID,
      }),
    );

    expect(response.status).toBe(201);
    expect(await transferAus(response)).toMatchObject({
      tripId: SUEDITALIEN_ID,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
      mode: "auto",
      title: "Fahrt nach Sorrent",
      durationMin: 45,
      distanceKm: 30.5,
    });
  });

  it("legt ihn auch an, wenn die Fahrzeit nicht in die Luecke passt", async () => {
    // Umgeplant wird nichts von selbst -- der Hinweis steht in der
    // Oberflaeche (req-052, Funktion).
    await angemeldet();

    const response = await POST(
      anfrage("POST", {
        ...ANGABEN,
        durationMin: 600,
        fromActivityId: POMPEJI_ID,
        toActivityId: SORRENT_ID,
      }),
    );

    expect(response.status).toBe(201);
  });

  it("legt zwischen denselben zwei Programmpunkten keinen zweiten an", async () => {
    await angemeldet();
    const werte = {
      ...ANGABEN,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
    };
    await POST(anfrage("POST", werte));

    const response = await POST(anfrage("POST", werte));

    expect(response.status).toBe(409);
    const transfers = await listTransfers(testDb.pool, ACCOUNT_ID);
    expect(
      transfers.filter(
        (t) => t.fromActivityId === POMPEJI_ID && t.toActivityId === SORRENT_ID,
      ),
    ).toHaveLength(1);
  });

  it("weist Angaben ohne Dauer zurueck", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", {
        ...ANGABEN,
        durationMin: "",
        fromActivityId: POMPEJI_ID,
        toActivityId: SORRENT_ID,
      }),
    );

    expect(response.status).toBe(400);
  });

  it("weist ein unbekanntes Verkehrsmittel zurueck", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", {
        ...ANGABEN,
        mode: "rakete",
        fromActivityId: POMPEJI_ID,
        toActivityId: SORRENT_ID,
      }),
    );

    expect(response.status).toBe(400);
  });

  it("legt keinen Transfer zwischen fremden Programmpunkten an", async () => {
    await angemeldet();
    const [von, nach] = await fremdeProgrammpunkte();

    const response = await POST(
      anfrage("POST", {
        ...ANGABEN,
        fromActivityId: von,
        toActivityId: nach,
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/transfers (req-052)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await PATCH(
      anfrage("PATCH", { id: VORHANDENER_TRANSFER_ID, ...ANGABEN }),
    );

    expect(response.status).toBe(401);
  });

  it("aendert Verkehrsmittel, Titel, Dauer und Strecke", async () => {
    await angemeldet();

    const response = await PATCH(
      anfrage("PATCH", {
        id: VORHANDENER_TRANSFER_ID,
        mode: "faehre",
        title: "Fähre zum Aussichtspunkt",
        durationMin: 45,
        distanceKm: 6.5,
      }),
    );

    expect(response.status).toBe(200);
    expect(await transferAus(response)).toMatchObject({
      id: VORHANDENER_TRANSFER_ID,
      mode: "faehre",
      title: "Fähre zum Aussichtspunkt",
      durationMin: 45,
      distanceKm: 6.5,
    });
  });

  it("kennt keinen Transfer eines fremden Accounts", async () => {
    await angemeldet();

    const response = await PATCH(
      anfrage("PATCH", { id: randomUUID(), ...ANGABEN }),
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/transfers (req-052)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await DELETE(
      anfrage("DELETE", { id: VORHANDENER_TRANSFER_ID }),
    );

    expect(response.status).toBe(401);
  });

  it("entfernt den Transfer", async () => {
    await angemeldet();

    const response = await DELETE(
      anfrage("DELETE", { id: VORHANDENER_TRANSFER_ID }),
    );

    expect(response.status).toBe(200);
    const transfers = await listTransfers(testDb.pool, ACCOUNT_ID);
    expect(transfers.some((t) => t.id === VORHANDENER_TRANSFER_ID)).toBe(false);
  });

  it("kennt keinen Transfer eines fremden Accounts", async () => {
    await angemeldet();

    const response = await DELETE(anfrage("DELETE", { id: randomUUID() }));

    expect(response.status).toBe(404);
  });
});
