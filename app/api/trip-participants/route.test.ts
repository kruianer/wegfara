// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { ACCOUNT_ID } from "@/lib/account";
import type { TripParticipant } from "@/lib/trip-participants/types";

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
const { createParticipant } = await import("@/lib/db/participants");
const { listTripParticipants } = await import("@/lib/db/trip-participants");
const { DELETE, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/trip-participants", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function clara() {
  return createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    new Date(Date.UTC(2026, 7, 17)),
  );
}

async function zuordnungen(): Promise<TripParticipant[]> {
  return listTripParticipants(testDb.pool, ACCOUNT_ID);
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("PUT /api/trip-participants (req-021)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await PUT(
      anfrage({
        tripId: SUEDITALIEN_ID,
        participantId: PARTICIPANT_ID,
        role: "teilnehmer",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("ordnet die Person der Reise zu", async () => {
    await angemeldet();
    const person = await clara();

    const response = await PUT(
      anfrage({
        tripId: SUEDITALIEN_ID,
        participantId: person.id,
        role: "teilnehmer",
      }),
    );

    expect(response.status).toBe(200);
    const { tripParticipant } = (await response.json()) as {
      tripParticipant: TripParticipant;
    };
    expect(tripParticipant).toEqual({
      tripId: SUEDITALIEN_ID,
      participantId: person.id,
      role: "teilnehmer",
    });
    expect(await zuordnungen()).toHaveLength(4);
  });

  it("aendert die Rolle einer zugeordneten Person", async () => {
    await angemeldet();
    const person = await clara();
    await PUT(
      anfrage({
        tripId: SUEDITALIEN_ID,
        participantId: person.id,
        role: "teilnehmer",
      }),
    );

    await PUT(
      anfrage({
        tripId: SUEDITALIEN_ID,
        participantId: person.id,
        role: "reiseleiter",
      }),
    );

    const zugeordnet = (await zuordnungen()).filter(
      (a) => a.tripId === SUEDITALIEN_ID && a.participantId === person.id,
    );
    expect(zugeordnet).toEqual([
      {
        tripId: SUEDITALIEN_ID,
        participantId: person.id,
        role: "reiseleiter",
      },
    ]);
  });

  it("stuft den letzten Reiseleiter nicht herab", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        tripId: SUEDITALIEN_ID,
        participantId: PARTICIPANT_ID,
        role: "teilnehmer",
      }),
    );

    expect(response.status).toBe(409);
    const zugeordnet = (await zuordnungen()).find(
      (a) => a.tripId === SUEDITALIEN_ID,
    );
    expect(zugeordnet?.role).toBe("reiseleiter");
  });

  it("weist eine unbekannte Rolle ab", async () => {
    await angemeldet();
    const person = await clara();

    const response = await PUT(
      anfrage({
        tripId: SUEDITALIEN_ID,
        participantId: person.id,
        role: "kassenfuehrer",
      }),
    );

    expect(response.status).toBe(400);
    expect(await zuordnungen()).toHaveLength(3);
  });

  it("weist eine unbekannte Reise ab", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        tripId: "1e2b7ad4-0f0f-4a53-9f3f-2c2b7f5f9999",
        participantId: PARTICIPANT_ID,
        role: "teilnehmer",
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/trip-participants (req-021)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await DELETE(
      anfrage({ tripId: SUEDITALIEN_ID, participantId: PARTICIPANT_ID }),
    );

    expect(response.status).toBe(401);
  });

  it("nimmt die Person aus der Reise", async () => {
    await angemeldet();
    const person = await clara();
    await PUT(
      anfrage({
        tripId: SUEDITALIEN_ID,
        participantId: person.id,
        role: "teilnehmer",
      }),
    );

    const response = await DELETE(
      anfrage({ tripId: SUEDITALIEN_ID, participantId: person.id }),
    );

    expect(response.status).toBe(200);
    expect(
      (await zuordnungen()).some((a) => a.participantId === person.id),
    ).toBe(false);
  });

  it("entfernt den letzten Reiseleiter nicht", async () => {
    await angemeldet();

    const response = await DELETE(
      anfrage({ tripId: SUEDITALIEN_ID, participantId: PARTICIPANT_ID }),
    );

    expect(response.status).toBe(409);
    expect(
      (await zuordnungen()).filter((a) => a.tripId === SUEDITALIEN_ID),
    ).toHaveLength(1);
  });
});
