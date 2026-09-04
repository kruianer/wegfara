// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
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
const { createCredential, listCredentials } = await import(
  "@/lib/db/credentials"
);
const { createParticipant } = await import("@/lib/db/participants");
const { DELETE } = await import("./route");

const NOW = new Date("2026-09-04T12:00:00Z");

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/auth/geraete", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify(body),
  });
}

function passkey(id: string, label: string, participantId = PARTICIPANT_ID) {
  return {
    id,
    participantId,
    publicKey: "oeffentlicher-schluessel",
    counter: 0,
    transports: [],
    label,
  };
}

/** Meldet den Betreiber auf dem iPhone an -- die Sitzung haengt am Passkey. */
async function angemeldetMitIphone() {
  await createCredential(testDb.pool, passkey("cred-iphone", "iPhone"), NOW);
  await createSession(
    testDb.pool,
    PARTICIPANT_ID,
    "token-iphone",
    NOW,
    "cred-iphone",
  );
  cookieJar.werte[SESSION_COOKIE] = "token-iphone";
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("Meine Geraete (req-037)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await DELETE(anfrage({ id: "cred-1" }))).status).toBe(401);
  });

  it("entfernt ein Geraet samt seiner Sitzungen", async () => {
    await angemeldetMitIphone();
    await createCredential(testDb.pool, passkey("cred-ipad", "iPad"), NOW);
    await createSession(
      testDb.pool,
      PARTICIPANT_ID,
      "token-ipad",
      NOW,
      "cred-ipad",
    );

    const response = await DELETE(anfrage({ id: "cred-ipad" }));

    expect(response.status).toBe(200);
    // Das iPad ist sofort abgemeldet und sieht beim naechsten Aufruf die
    // Anmeldeseite.
    expect(await findSessionByToken(testDb.pool, "token-ipad", NOW)).toBeNull();
    expect(
      await findSessionByToken(testDb.pool, "token-iphone", NOW),
    ).not.toBeNull();
    expect(
      (await listCredentials(testDb.pool, PARTICIPANT_ID)).map((c) => c.id),
    ).toEqual(["cred-iphone"]);
  });

  it("laesst eine Sitzung aus dem Anmeldelink bestehen", async () => {
    await createCredential(testDb.pool, passkey("cred-ipad", "iPad"), NOW);
    await createSession(testDb.pool, PARTICIPANT_ID, "token-link", NOW);
    cookieJar.werte[SESSION_COOKIE] = "token-link";

    await DELETE(anfrage({ id: "cred-ipad" }));

    expect(
      await findSessionByToken(testDb.pool, "token-link", NOW),
    ).not.toBeNull();
  });

  it("laesst den letzten Passkey entfernen, weil eine Adresse hinterlegt ist", async () => {
    await angemeldetMitIphone();

    expect((await DELETE(anfrage({ id: "cred-iphone" }))).status).toBe(200);
  });

  it("verweigert den letzten Passkey ohne hinterlegte Adresse", async () => {
    // Sonst sperrt sich der Nutzer selbst aus.
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
      NOW,
    );
    await createCredential(
      testDb.pool,
      passkey("cred-clara", "Handy", clara.id),
      NOW,
    );
    await createSession(
      testDb.pool,
      clara.id,
      "token-clara",
      NOW,
      "cred-clara",
    );
    cookieJar.werte[SESSION_COOKIE] = "token-clara";

    const response = await DELETE(anfrage({ id: "cred-clara" }));

    expect(response.status).toBe(409);
    expect(await listCredentials(testDb.pool, clara.id)).toHaveLength(1);
  });

  it("reicht nie an den Passkey einer anderen Person", async () => {
    await angemeldetMitIphone();
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
    await createCredential(
      testDb.pool,
      passkey("cred-clara", "Handy", clara.id),
      NOW,
    );

    const response = await DELETE(anfrage({ id: "cred-clara" }));

    expect(response.status).toBe(404);
    expect(await listCredentials(testDb.pool, clara.id)).toHaveLength(1);
  });

  it("kommt mit einer Anfrage ohne Kennung zurecht", async () => {
    await angemeldetMitIphone();

    expect((await DELETE(anfrage({}))).status).toBe(404);
  });
});
