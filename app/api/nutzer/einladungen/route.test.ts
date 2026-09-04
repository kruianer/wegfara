// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { MailMessage } from "@/lib/mail/mailer";
import type { Invitation } from "@/lib/invitations/types";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
const postfach = vi.hoisted(() => ({ nachrichten: [] as unknown[] }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));
vi.mock("@/lib/mail/smtp-mailer", () => ({
  smtpMailer: {
    send: async (message: unknown) => {
      postfach.nachrichten.push(message);
      return true;
    },
  },
}));

const { createSession } = await import("@/lib/db/sessions");
const { createParticipant } = await import("@/lib/db/participants");
const { listOpenInvitations } = await import("@/lib/db/account-users");
const { consumeAccessLink } = await import("@/lib/db/access-links");
const { POST, DELETE } = await import("./route");

const NOW = new Date();

function anfrage(method: "POST" | "DELETE", body: unknown) {
  return new Request("https://dev.wegfara.com/api/nutzer/einladungen", {
    method,
    body: JSON.stringify(body),
  });
}

async function alsAdmin() {
  await createSession(testDb.pool, PARTICIPANT_ID, "admin-token", NOW);
  cookieJar.werte[SESSION_COOKIE] = "admin-token";
}

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
  postfach.nachrichten = [];
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("POST /api/nutzer/einladungen (req-038)", () => {
  it("weist ohne Anmeldung ab", async () => {
    const response = await POST(
      anfrage("POST", { name: "Eva", email: "eva@example.com" }),
    );

    expect(response.status).toBe(401);
  });

  it("weist einen Teilnehmer ohne Kennzeichnung ab", async () => {
    await alsTeilnehmerin();

    const response = await POST(
      anfrage("POST", { name: "Eva", email: "eva@example.com" }),
    );

    expect(response.status).toBe(403);
  });

  it("laedt per E-Mail ein und liefert den Zugangslink genau einmal", async () => {
    await alsAdmin();

    const response = await POST(
      anfrage("POST", { name: "Eva Huber", email: "eva@example.com" }),
    );

    expect(response.status).toBe(201);
    const { invitation } = (await response.json()) as {
      invitation: Invitation;
    };
    expect(invitation.url).toContain(
      "https://dev.wegfara.com/einladung?token=",
    );
    expect(invitation.qr.path.length).toBeGreaterThan(0);
    expect(postfach.nachrichten).toHaveLength(1);
    expect((postfach.nachrichten[0] as MailMessage).to).toBe("eva@example.com");
  });

  it("weist eine Einladung ohne E-Mail-Adresse ab", async () => {
    await alsAdmin();

    const response = await POST(anfrage("POST", { name: "Eva Huber" }));

    expect(response.status).toBe(400);
    expect(await listOpenInvitations(testDb.pool, ACCOUNT_ID, NOW)).toEqual([]);
  });
});

describe("DELETE /api/nutzer/einladungen (req-038)", () => {
  it("entwertet den Link serverseitig sofort", async () => {
    await alsAdmin();
    const response = await POST(
      anfrage("POST", { name: "Eva Huber", email: "eva@example.com" }),
    );
    const { invitation } = (await response.json()) as {
      invitation: Invitation;
    };
    const token = new URL(invitation.url).searchParams.get("token")!;

    const zurueck = await DELETE(
      anfrage("DELETE", { participantId: invitation.participantId }),
    );

    expect(zurueck.status).toBe(200);
    expect(await consumeAccessLink(testDb.pool, token, NOW)).toBeNull();
    expect(await listOpenInvitations(testDb.pool, ACCOUNT_ID, NOW)).toEqual([]);
  });

  it("weist einen Teilnehmer ohne Kennzeichnung ab", async () => {
    const clara = await alsTeilnehmerin();

    const response = await DELETE(
      anfrage("DELETE", { participantId: clara.id }),
    );

    expect(response.status).toBe(403);
  });

  it("kennt eine Person eines fremden Accounts nicht", async () => {
    await alsAdmin();

    const response = await DELETE(
      anfrage("DELETE", {
        participantId: "8e5d4d05-2e42-4a2f-9e4a-6f1b2c3d4e5f",
      }),
    );

    expect(response.status).toBe(404);
  });
});
