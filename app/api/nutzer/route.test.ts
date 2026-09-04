// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { AccountUser, OpenInvitation } from "@/lib/db/account-users";

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
const { createAccessLink } = await import("@/lib/db/access-links");
const { GET } = await import("./route");

const NOW = new Date();

/** Der Betreiber -- der einzige Account-Admin der Demodaten. */
async function alsAdmin() {
  await createSession(testDb.pool, PARTICIPANT_ID, "admin-token", NOW);
  cookieJar.werte[SESSION_COOKIE] = "admin-token";
}

/** Clara Berger: Teilnehmerin ohne Kennzeichnung. */
async function alsTeilnehmerin() {
  const person = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: "clara@example.com",
      phone: null,
      iban: null,
    },
    NOW,
  );
  await createSession(testDb.pool, person.id, "clara-token", NOW);
  cookieJar.werte[SESSION_COOKIE] = "clara-token";
  return person;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("GET /api/nutzer (req-038)", () => {
  it("weist ohne Anmeldung ab", async () => {
    expect((await GET()).status).toBe(401);
  });

  it("weist einen Teilnehmer ohne Kennzeichnung ab -- auch beim direkten Aufruf", async () => {
    await alsTeilnehmerin();

    expect((await GET()).status).toBe(403);
  });

  it("liefert dem Bereichs-Admin Personen und offene Einladungen", async () => {
    await alsAdmin();
    const clara = await createParticipant(
      testDb.pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: "clara@example.com",
        phone: null,
        iban: null,
      },
      NOW,
    );
    await createAccessLink(testDb.pool, clara.id, "einladungs-token", NOW);

    const response = await GET();

    expect(response.status).toBe(200);
    const { users, invitations } = (await response.json()) as {
      users: AccountUser[];
      invitations: OpenInvitation[];
    };
    expect(users.map((user) => user.name)).toContain("Clara Berger");
    expect(users[0]).toHaveProperty("joinedAt");
    expect(users[0]).toHaveProperty("lastSignInAt");
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({
      participantId: clara.id,
      email: "clara@example.com",
    });
  });

  it("gibt kein Geheimnis einer Einladung preis", async () => {
    await alsAdmin();
    const clara = await createParticipant(
      testDb.pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: "clara@example.com",
        phone: null,
        iban: null,
      },
      NOW,
    );
    await createAccessLink(testDb.pool, clara.id, "einladungs-token", NOW);

    const text = await (await GET()).text();

    expect(text).not.toContain("einladungs-token");
  });
});
