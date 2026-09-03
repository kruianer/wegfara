// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Invitation } from "@/lib/invitations/types";

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
const { consumeAccessLink } = await import("@/lib/db/access-links");
const { createAccountWithFirstPerson } = await import(
  "@/lib/accounts/create-account"
);
const { POST } = await import("./route");

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/accounts/einladung", {
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
}

function familieHuber() {
  return createAccountWithFirstPerson(
    testDb.pool,
    {
      name: "Familie Huber",
      personName: "Anna Huber",
      personEmail: "anna@huber.de",
    },
    new Date(),
  );
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("POST /api/accounts/einladung (req-025)", () => {
  it("liefert den Zugangslink der ersten Person", async () => {
    await alsGesamtAdmin();
    const account = await familieHuber();

    const response = await POST(anfrage({ accountId: account!.id }));

    expect(response.status).toBe(201);
    const { invitation } = (await response.json()) as {
      invitation: Invitation;
    };
    expect(invitation.participantId).toBe(account!.firstPerson!.id);
    expect(invitation.url).toContain(
      "https://dev.wegfara.com/einladung?token=",
    );
    expect(invitation.qr.size).toBeGreaterThan(0);
    expect(invitation.qr.path.length).toBeGreaterThan(0);
  });

  it("bindet den Link an genau diese Person und entwertet ihn beim Einloesen", async () => {
    await alsGesamtAdmin();
    const account = await familieHuber();
    const response = await POST(anfrage({ accountId: account!.id }));
    const { invitation } = (await response.json()) as {
      invitation: Invitation;
    };
    const token = new URL(invitation.url).searchParams.get("token") ?? "";

    expect(await consumeAccessLink(testDb.pool, token, new Date())).toBe(
      account!.firstPerson!.id,
    );
    expect(await consumeAccessLink(testDb.pool, token, new Date())).toBeNull();
  });

  it("erzeugt fuer eine gewoehnliche Person keine Einladung", async () => {
    const account = await familieHuber();
    await alsGewoehnlichePerson();

    const response = await POST(anfrage({ accountId: account!.id }));

    expect(response.status).toBe(403);
    const { rows } = await testDb.pool.query("select id from access_link");
    expect(rows).toHaveLength(0);
  });

  it("erzeugt ohne Anmeldung keine Einladung", async () => {
    const account = await familieHuber();

    const response = await POST(anfrage({ accountId: account!.id }));

    expect(response.status).toBe(401);
    const { rows } = await testDb.pool.query("select id from access_link");
    expect(rows).toHaveLength(0);
  });

  it("liefert 404 fuer einen Account, den es nicht gibt", async () => {
    await alsGesamtAdmin();

    const response = await POST(
      anfrage({ accountId: "6f1f6a2b-0000-4000-8000-000000000000" }),
    );

    expect(response.status).toBe(404);
  });
});
