// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Die Schnittstelle der Stimme (req-054): abgeben darf nur, wer zu dieser
 * Reise gehoert -- und nur, solange die Runde laeuft.
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
const { endRatingRound, listRatingVotes, startRatingRound } = await import(
  "@/lib/db/rating-rounds"
);
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const POMPEJI = "462f6811-13cc-4247-99aa-8b9693955ab7";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SPAETER = new Date("2026-09-08T10:00:00.000Z");

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/stimmen", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet(participantId: string, token = "token-1") {
  await createSession(testDb.pool, participantId, token, NOW);
  cookieJar.werte[SESSION_COOKIE] = token;
}

/** Eine laufende Runde ueber Pompeji, gestartet vom Reiseleiter. */
async function laufendeRunde(): Promise<string> {
  const result = await startRatingRound(
    testDb.pool,
    ACCOUNT_ID,
    PARTICIPANT_ID,
    SUEDITALIEN_ID,
    [POMPEJI],
    NOW,
  );
  if (!result.ok) throw new Error("Runde nicht gestartet");
  return result.runde.id;
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

/** Eine Person desselben Accounts, die bei dieser Reise nicht mitfaehrt. */
async function aussenstehend(): Promise<string> {
  const id = randomUUID();
  await testDb.pool.query(
    `insert into participant (id, account_id, name, created_at)
     values ($1, $2, $3, $4)`,
    [id, ACCOUNT_ID, "Dora Klein", NOW],
  );
  return id;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/stimmen (req-054)", () => {
  it("verlangt eine Anmeldung", async () => {
    const roundId = await laufendeRunde();

    const response = await POST(
      anfrage({ roundId, poiId: POMPEJI, wahl: "unbedingt" }),
    );

    expect(response.status).toBe(401);
    expect(await listRatingVotes(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("speichert die Stimme eines Teilnehmers", async () => {
    const roundId = await laufendeRunde();
    const person = await clara();
    await angemeldet(person);

    const response = await POST(
      anfrage({ roundId, poiId: POMPEJI, wahl: "unbedingt" }),
    );

    expect(response.status).toBe(200);
    expect(await listRatingVotes(testDb.pool, ACCOUNT_ID)).toEqual([
      {
        roundId,
        poiId: POMPEJI,
        participantId: person,
        wahl: "unbedingt",
      },
    ]);
  });

  it("uebernimmt eine geaenderte Stimme", async () => {
    const roundId = await laufendeRunde();
    const person = await clara();
    await angemeldet(person);
    await POST(anfrage({ roundId, poiId: POMPEJI, wahl: "waere_schoen" }));

    const response = await POST(
      anfrage({ roundId, poiId: POMPEJI, wahl: "ohne_mich" }),
    );

    expect(response.status).toBe(200);
    const stimmen = await listRatingVotes(testDb.pool, ACCOUNT_ID);
    expect(stimmen).toHaveLength(1);
    expect(stimmen[0].wahl).toBe("ohne_mich");
  });

  it("weist ab, wer nicht zu dieser Reise gehoert", async () => {
    const roundId = await laufendeRunde();
    const person = await aussenstehend();
    await angemeldet(person);

    const response = await POST(
      anfrage({ roundId, poiId: POMPEJI, wahl: "unbedingt" }),
    );

    expect(response.status).toBe(403);
    expect(await listRatingVotes(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("nimmt nach dem Beenden der Runde keine Stimme mehr an", async () => {
    const roundId = await laufendeRunde();
    const person = await clara();
    await endRatingRound(
      testDb.pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      roundId,
      SPAETER,
    );
    await angemeldet(person);

    const response = await POST(
      anfrage({ roundId, poiId: POMPEJI, wahl: "unbedingt" }),
    );

    expect(response.status).toBe(409);
    expect(await listRatingVotes(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("weist eine unbekannte Stimme ab", async () => {
    const roundId = await laufendeRunde();
    const person = await clara();
    await angemeldet(person);

    const response = await POST(
      anfrage({ roundId, poiId: POMPEJI, wahl: "vielleicht" }),
    );

    expect(response.status).toBe(400);
    expect(await listRatingVotes(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });
});
