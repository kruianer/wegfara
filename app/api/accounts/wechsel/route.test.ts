// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const { createSession, findSessionByToken } = await import("@/lib/db/sessions");
const { createParticipant } = await import("@/lib/db/participants");
const { createAccount } = await import("@/lib/db/accounts");
const { listAccountSwitches } = await import("@/lib/db/account-switches");
const { POST } = await import("./route");

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/accounts/wechsel", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function alsGesamtAdmin() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function alsGewoehnlichePerson() {
  const clara = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    new Date(),
  );
  await createSession(testDb.pool, clara.id, "token-2", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-2";
  return clara;
}

function huber() {
  return createAccount(testDb.pool, "Familie Huber", "anna@huber.de");
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/accounts/wechsel (req-025)", () => {
  it("bringt den Gesamt-Admin in den fremden Account", async () => {
    await alsGesamtAdmin();
    const account = await huber();

    const response = await POST(anfrage({ accountId: account.id }));

    expect(response.status).toBe(200);
    const session = await findSessionByToken(
      testDb.pool,
      "token-1",
      new Date(),
    );
    expect(session?.accountId).toBe(account.id);
    expect(session?.actingAccount?.name).toBe("Familie Huber");
  });

  it("haelt den Wechsel fest: wer, in welchen Account, wann", async () => {
    await alsGesamtAdmin();
    const account = await huber();

    await POST(anfrage({ accountId: account.id }));

    const eintraege = await listAccountSwitches(testDb.pool);
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].participantName).toBe("Uwe Kremmel");
    expect(eintraege[0].accountName).toBe("Familie Huber");
    expect(eintraege[0].switchedAt).toBeInstanceOf(Date);
  });

  it("bringt ihn ohne Kennung wieder in seinen eigenen Account", async () => {
    await alsGesamtAdmin();
    const account = await huber();
    await POST(anfrage({ accountId: account.id }));

    const response = await POST(anfrage({}));

    expect(response.status).toBe(200);
    const session = await findSessionByToken(
      testDb.pool,
      "token-1",
      new Date(),
    );
    expect(session?.accountId).toBe(ACCOUNT_ID);
    expect(session?.actingAccount).toBeNull();
  });

  it("laesst eine gewoehnliche Person nicht wechseln", async () => {
    const clara = await alsGewoehnlichePerson();
    const account = await huber();

    const response = await POST(anfrage({ accountId: account.id }));

    expect(response.status).toBe(403);
    const session = await findSessionByToken(
      testDb.pool,
      "token-2",
      new Date(),
    );
    expect(session?.accountId).toBe(clara.accountId);
    expect(await listAccountSwitches(testDb.pool)).toEqual([]);
  });

  it("weist den Wechsel ohne Anmeldung zurueck", async () => {
    const account = await huber();

    const response = await POST(anfrage({ accountId: account.id }));

    expect(response.status).toBe(401);
    expect(await listAccountSwitches(testDb.pool)).toEqual([]);
  });

  it("wechselt nicht in einen Account, den es nicht gibt", async () => {
    await alsGesamtAdmin();

    const response = await POST(
      anfrage({ accountId: "6f1f6a2b-0000-4000-8000-000000000000" }),
    );

    expect(response.status).toBe(404);
    const session = await findSessionByToken(
      testDb.pool,
      "token-1",
      new Date(),
    );
    expect(session?.accountId).toBe(ACCOUNT_ID);
  });
});
