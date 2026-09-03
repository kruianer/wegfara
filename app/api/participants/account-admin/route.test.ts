// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Participant } from "@/lib/participants/types";

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
const { createParticipant, findParticipantInAccount } = await import(
  "@/lib/db/participants"
);
const { PUT } = await import("./route");

const NOW = new Date("2026-09-03T10:00:00Z");

const CLARA = {
  name: "Clara Berger",
  nickname: null,
  email: "clara@example.com",
  phone: null,
  iban: null,
};

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/participants/account-admin", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Der Betreiber -- Account-Admin seines Accounts (req-027). */
async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", NOW);
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Eine zweite Person des Accounts, ohne die Kennzeichnung. */
function clara(): Promise<Participant> {
  return createParticipant(testDb.pool, ACCOUNT_ID, CLARA, NOW);
}

async function kennzeichnung(id: string): Promise<boolean | undefined> {
  const person = await findParticipantInAccount(testDb.pool, ACCOUNT_ID, id);
  return person?.accountAdmin;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("PUT /api/participants/account-admin (req-027)", () => {
  it("verlangt eine Anmeldung", async () => {
    const person = await clara();

    const response = await PUT(anfrage({ id: person.id, accountAdmin: true }));

    expect(response.status).toBe(401);
  });

  it("ernennt eine Person zum Account-Admin", async () => {
    await angemeldet();
    const person = await clara();

    const response = await PUT(anfrage({ id: person.id, accountAdmin: true }));

    expect(response.status).toBe(200);
    const { participant } = (await response.json()) as {
      participant: Participant;
    };
    expect(participant.accountAdmin).toBe(true);
    expect(await kennzeichnung(person.id)).toBe(true);
  });

  it("entzieht die Kennzeichnung wieder", async () => {
    await angemeldet();
    const person = await clara();
    await PUT(anfrage({ id: person.id, accountAdmin: true }));

    const response = await PUT(anfrage({ id: person.id, accountAdmin: false }));

    expect(response.status).toBe(200);
    expect(await kennzeichnung(person.id)).toBe(false);
  });

  it("laesst dem letzten Account-Admin die Kennzeichnung", async () => {
    await angemeldet();
    await clara();

    const response = await PUT(
      anfrage({ id: PARTICIPANT_ID, accountAdmin: false }),
    );

    expect(response.status).toBe(409);
    expect(await kennzeichnung(PARTICIPANT_ID)).toBe(true);
  });

  it("weist eine Person ohne die Kennzeichnung ab", async () => {
    const person = await clara();
    await createSession(testDb.pool, person.id, "token-2", NOW);
    cookieJar.werte[SESSION_COOKIE] = "token-2";

    const response = await PUT(anfrage({ id: person.id, accountAdmin: true }));

    expect(response.status).toBe(403);
    expect(await kennzeichnung(person.id)).toBe(false);
  });

  it("kennt keine Person eines anderen Accounts", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        id: "00000000-0000-4000-8000-000000000001",
        accountAdmin: true,
      }),
    );

    expect(response.status).toBe(404);
  });

  it("weist eine Anfrage ohne Kennzeichnung als unzulaessig ab", async () => {
    await angemeldet();
    const person = await clara();

    const response = await PUT(anfrage({ id: person.id }));

    expect(response.status).toBe(400);
    expect(await kennzeichnung(person.id)).toBe(false);
  });
});
