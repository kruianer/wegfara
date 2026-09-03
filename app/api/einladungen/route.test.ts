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
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { consumeAccessLink } = await import("@/lib/db/access-links");
const { POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/einladungen", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function claraInSueditalien() {
  const person = await createParticipant(
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
  await assignTripParticipant(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    person.id,
    "teilnehmer",
  );
  return person;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("POST /api/einladungen (req-023)", () => {
  it("liefert Zugangslink und QR-Code zu einer zugeordneten Person", async () => {
    await angemeldet();
    const person = await claraInSueditalien();

    const response = await POST(anfrage({ participantId: person.id }));

    expect(response.status).toBe(201);
    const { invitation } = (await response.json()) as {
      invitation: Invitation;
    };
    expect(invitation.participantId).toBe(person.id);
    expect(invitation.url).toContain(
      "https://dev.wegfara.com/einladung?token=",
    );
    expect(invitation.qr.size).toBeGreaterThan(20);
    expect(invitation.qr.path.length).toBeGreaterThan(0);
  });

  it("bindet den Link an genau diese Person", async () => {
    await angemeldet();
    const person = await claraInSueditalien();

    const response = await POST(anfrage({ participantId: person.id }));
    const { invitation } = (await response.json()) as {
      invitation: Invitation;
    };
    const token = new URL(invitation.url).searchParams.get("token") ?? "";

    expect(await consumeAccessLink(testDb.pool, token, new Date())).toBe(
      person.id,
    );
  });

  it("weist ohne Anmeldung ab", async () => {
    const person = await claraInSueditalien();

    const response = await POST(anfrage({ participantId: person.id }));

    expect(response.status).toBe(401);
  });

  it("kennt eine Person ohne Reise nicht", async () => {
    await angemeldet();
    const person = await createParticipant(
      testDb.pool,
      ACCOUNT_ID,
      {
        name: "Max Gast",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      new Date(),
    );

    const response = await POST(anfrage({ participantId: person.id }));

    expect(response.status).toBe(404);
  });

  it("weist eine Anfrage ohne Person ab", async () => {
    await angemeldet();

    expect((await POST(anfrage({}))).status).toBe(400);
    expect((await POST(anfrage({ participantId: "  " }))).status).toBe(400);
  });
});
