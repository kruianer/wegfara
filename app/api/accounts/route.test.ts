// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { ACCOUNT_ERRORS } from "@/lib/accounts/validate";
import type { AccountOverview } from "@/lib/accounts/types";

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
const { listAccountsOverview } = await import("@/lib/db/accounts");
const { POST } = await import("./route");

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const HUBER = {
  name: "Familie Huber",
  personName: "Anna Huber",
  personEmail: "anna@huber.de",
};

/** Der Gesamt-Admin -- die Kennzeichnung steht in der Datenbank (req-025). */
async function alsGesamtAdmin() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Eine gewoehnliche Person desselben Accounts. */
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
}

async function accountNamen(): Promise<string[]> {
  const uebersicht = await listAccountsOverview(testDb.pool, new Date());
  return uebersicht.map((entry) => entry.name);
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/accounts (req-025)", () => {
  it("legt Account und erste Person an", async () => {
    await alsGesamtAdmin();

    const response = await POST(anfrage(HUBER));

    expect(response.status).toBe(201);
    const { account } = (await response.json()) as { account: AccountOverview };
    expect(account).toMatchObject({ name: "Familie Huber", personCount: 1 });
    expect(account.firstPerson).toMatchObject({ name: "Anna Huber" });
    expect(await accountNamen()).toContain("Familie Huber");
  });

  it("legt ohne Anmeldung keinen Account an", async () => {
    const response = await POST(anfrage(HUBER));

    expect(response.status).toBe(401);
    expect(await accountNamen()).not.toContain("Familie Huber");
  });

  it("legt fuer eine gewoehnliche Person keinen Account an", async () => {
    await alsGewoehnlichePerson();

    const response = await POST(anfrage(HUBER));

    expect(response.status).toBe(403);
    expect(await accountNamen()).not.toContain("Familie Huber");
  });

  it("weist unvollstaendige Angaben zurueck und benennt die Stelle", async () => {
    await alsGesamtAdmin();

    const response = await POST(anfrage({ ...HUBER, personEmail: "" }));

    expect(response.status).toBe(400);
    const { errors } = (await response.json()) as {
      errors: Record<string, string>;
    };
    expect(errors.personEmail).toBe(ACCOUNT_ERRORS.emailRequired);
    expect(await accountNamen()).not.toContain("Familie Huber");
  });

  it("weist eine bereits vergebene Adresse zurueck", async () => {
    await alsGesamtAdmin();

    const response = await POST(
      anfrage({ ...HUBER, personEmail: "uwe@kremmel.org" }),
    );

    expect(response.status).toBe(400);
    const { errors } = (await response.json()) as {
      errors: Record<string, string>;
    };
    expect(errors.personEmail).toBe(ACCOUNT_ERRORS.emailTaken);
    expect(await accountNamen()).not.toContain("Familie Huber");
  });
});
