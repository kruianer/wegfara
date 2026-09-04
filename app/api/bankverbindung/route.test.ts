// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Die Bankverbindung fuer den Ueberweisungscode (req-031). Sie ist ein
 * personenbezogenes Datum und nur fuer angemeldete Personen desselben
 * Accounts sichtbar (siehe delivery/security.md) -- gepruefen wird das hier,
 * nicht in der Oberflaeche.
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
const { createParticipant } = await import("@/lib/db/participants");
const { createAccount } = await import("@/lib/db/accounts");
const { GET } = await import("./route");

const NOW = new Date("2026-09-03T10:00:00Z");
const IBAN = "DE89370400440532013000";

function anfrage(participantId: string) {
  return new Request(
    `https://dev.wegfara.com/api/bankverbindung?teilnehmer=${participantId}`,
  );
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", NOW);
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Der Empfaenger einer Zahlung -- mit hinterlegter Bankverbindung. */
async function empfaenger(iban: string | null) {
  return createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Uwe Kremmel",
      nickname: "Uwi",
      email: "uwe@example.com",
      phone: "+49 170 1234567",
      iban,
    },
    NOW,
  );
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("GET /api/bankverbindung (req-031)", () => {
  it("weist ohne Anmeldung ab", async () => {
    const person = await empfaenger(IBAN);

    const response = await GET(anfrage(person.id));

    expect(response.status).toBe(401);
  });

  it("gibt die Bankverbindung einer Person des eigenen Accounts heraus", async () => {
    await angemeldet();
    const person = await empfaenger(IBAN);

    const response = await GET(anfrage(person.id));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ iban: IBAN });
  });

  it("gibt sonst nichts von der Person heraus", async () => {
    await angemeldet();
    const person = await empfaenger(IBAN);

    const payload = (await (await GET(anfrage(person.id))).json()) as Record<
      string,
      unknown
    >;

    // Telefonnummer, E-Mail und Nickname gehen niemanden etwas an, der eine
    // Ueberweisung vorbereitet.
    expect(Object.keys(payload)).toEqual(["iban"]);
  });

  it("meldet eine Person ohne hinterlegte Bankverbindung als solche", async () => {
    await angemeldet();
    const person = await empfaenger(null);

    const response = await GET(anfrage(person.id));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ iban: null });
  });

  it("kennt die Person eines fremden Accounts nicht", async () => {
    await angemeldet();
    const fremd = await createAccount(
      testDb.pool,
      "Familie Berger",
      "berger@example.com",
    );
    const person = await createParticipant(
      testDb.pool,
      fremd.id,
      {
        name: "Clara Berger",
        nickname: null,
        email: "clara@example.com",
        phone: null,
        iban: IBAN,
      },
      NOW,
    );

    const response = await GET(anfrage(person.id));

    expect(response.status).toBe(404);
  });

  it("weist eine Anfrage ohne Person ab", async () => {
    await angemeldet();

    const response = await GET(
      new Request("https://dev.wegfara.com/api/bankverbindung"),
    );

    expect(response.status).toBe(400);
  });
});
