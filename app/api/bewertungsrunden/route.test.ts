// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Die Schnittstelle der Bewertungsrunde (req-054): starten und beenden darf
 * nur der Reiseleiter -- geprueft serverseitig, nicht in der Oberflaeche.
 */

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
const { listRatingRounds } = await import("@/lib/db/rating-rounds");
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { POST, PATCH } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const POMPEJI = "462f6811-13cc-4247-99aa-8b9693955ab7";
const VILLA_RUFOLO = "b6652937-9196-4a63-ab17-5edfdda66642";
const MATERA = "4137c2d0-0bc9-41bb-998a-2cf9eaac4edf";

const NOW = new Date("2026-09-07T10:00:00.000Z");

function anfrage(body: unknown, method: "POST" | "PATCH" = "POST") {
  return new Request("https://dev.wegfara.com/api/bewertungsrunden", {
    method,
    body: JSON.stringify(body),
  });
}

/** Meldet eine Person an -- ohne Angabe den Betreiber (Reiseleiter). */
async function angemeldet(participantId = PARTICIPANT_ID) {
  await createSession(testDb.pool, participantId, "token-1", NOW);
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Clara faehrt bei der Suditalien Rundreise als Teilnehmerin mit. */
async function clara(): Promise<string> {
  const id = randomUUID();
  await testDb.pool.query(
    `insert into participant (id, account_id, name, created_at)
     values ($1, $2, $3, $4)`,
    [id, ACCOUNT_ID, "Clara Berger", NOW],
  );
  await assignTripParticipant(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    id,
    "teilnehmer",
  );
  return id;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/bewertungsrunden (req-054)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, poiIds: [POMPEJI] }),
    );

    expect(response.status).toBe(401);
    expect(await listRatingRounds(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("startet als Reiseleiter eine Runde ueber genau die gewaehlten POIs", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({
        tripId: SUEDITALIEN_ID,
        poiIds: [POMPEJI, VILLA_RUFOLO, MATERA],
      }),
    );

    expect(response.status).toBe(200);
    const runden = await listRatingRounds(testDb.pool, ACCOUNT_ID);
    expect(runden).toHaveLength(1);
    expect(runden[0].status).toBe("laeuft");
    expect(runden[0].poiIds).toEqual([POMPEJI, VILLA_RUFOLO, MATERA]);
  });

  it("weist einen Teilnehmer ab, der nicht Reiseleiter ist", async () => {
    const person = await clara();
    await angemeldet(person);

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, poiIds: [POMPEJI] }),
    );

    expect(response.status).toBe(403);
    expect(await listRatingRounds(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("weist eine Anfrage ohne POI ab", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, poiIds: [] }),
    );

    expect(response.status).toBe(400);
  });

  it("weist eine zweite laufende Runde derselben Reise ab", async () => {
    await angemeldet();
    await POST(anfrage({ tripId: SUEDITALIEN_ID, poiIds: [POMPEJI] }));

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, poiIds: [VILLA_RUFOLO] }),
    );

    expect(response.status).toBe(409);
    expect(await listRatingRounds(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });
});

describe("PATCH /api/bewertungsrunden (req-054)", () => {
  async function gestartet(): Promise<string> {
    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, poiIds: [POMPEJI] }),
    );
    const body = (await response.json()) as { runde: { id: string } };
    return body.runde.id;
  }

  it("beendet als Reiseleiter die laufende Runde", async () => {
    await angemeldet();
    const roundId = await gestartet();

    const response = await PATCH(anfrage({ roundId }, "PATCH"));

    expect(response.status).toBe(200);
    expect((await listRatingRounds(testDb.pool, ACCOUNT_ID))[0].status).toBe(
      "beendet",
    );
  });

  it("weist einen Teilnehmer ab, der nicht Reiseleiter ist", async () => {
    await angemeldet();
    const roundId = await gestartet();
    const person = await clara();
    await createSession(testDb.pool, person, "token-2", NOW);
    cookieJar.werte[SESSION_COOKIE] = "token-2";

    const response = await PATCH(anfrage({ roundId }, "PATCH"));

    expect(response.status).toBe(403);
    expect((await listRatingRounds(testDb.pool, ACCOUNT_ID))[0].status).toBe(
      "laeuft",
    );
  });

  it("weist eine unbekannte Runde ab", async () => {
    await angemeldet();

    const response = await PATCH(anfrage({ roundId: randomUUID() }, "PATCH"));

    expect(response.status).toBe(404);
  });
});
