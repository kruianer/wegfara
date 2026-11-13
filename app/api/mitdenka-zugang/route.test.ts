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

const { createSession } = await import("@/lib/db/sessions");
const { createParticipant } = await import("@/lib/db/participants");
const { pruefeMitdenkaZugang } = await import("@/lib/werkzeuge/zugang");
const { POST, DELETE } = await import("./route");

const NOW = new Date();

/** Der Betreiber -- Account-Admin seines Accounts (req-027). */
async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", NOW);
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Eine zweite Person des Accounts, ohne die Kennzeichnung. */
async function angemeldetOhneKennzeichnung() {
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
  await createSession(testDb.pool, person.id, "token-2", NOW);
  cookieJar.werte[SESSION_COOKIE] = "token-2";
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/mitdenka-zugang (req-104)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST()).status).toBe(401);
  });

  it("weist eine Person ohne die Kennzeichnung Account-Admin ab", async () => {
    await angemeldetOhneKennzeichnung();

    expect((await POST()).status).toBe(403);
    const { rows } = await testDb.pool.query(`select * from mitdenka_zugang`);
    expect(rows).toHaveLength(0);
  });

  it("liefert dem Account-Admin den Schluessel einmal im Klartext", async () => {
    await angemeldet();

    const response = await POST();
    expect(response.status).toBe(200);
    const { schluessel, stand } = (await response.json()) as {
      schluessel: string;
      stand: { vorhanden: boolean };
    };
    expect(stand.vorhanden).toBe(true);
    expect(await pruefeMitdenkaZugang(testDb.pool, schluessel, NOW)).toBe(
      ACCOUNT_ID,
    );
  });
});

describe("DELETE /api/mitdenka-zugang (req-104)", () => {
  it("weist eine Person ohne die Kennzeichnung ab", async () => {
    await angemeldetOhneKennzeichnung();

    expect((await DELETE()).status).toBe(403);
  });

  it("widerruft den Schluessel", async () => {
    await angemeldet();
    const { schluessel } = (await (await POST()).json()) as {
      schluessel: string;
    };

    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { stand: { vorhanden: boolean } }).stand
        .vorhanden,
    ).toBe(false);
    expect(await pruefeMitdenkaZugang(testDb.pool, schluessel, NOW)).toBeNull();
  });
});
