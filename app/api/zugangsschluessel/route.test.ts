// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { ApiKeyState } from "@/lib/api-keys/types";

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
const { accountApiKey } = await import("@/lib/api-keys/account-keys");
const { PUT, DELETE } = await import("./route");

const NOW = new Date("2026-09-03T10:00:00Z");

function anfrage(method: "PUT" | "DELETE", body: unknown) {
  return new Request("https://dev.wegfara.com/api/zugangsschluessel", {
    method,
    body: JSON.stringify(body),
  });
}

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

async function zustand(response: Response): Promise<ApiKeyState[]> {
  const { keys } = (await response.json()) as { keys: ApiKeyState[] };
  return keys;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
});

describe("PUT /api/zugangsschluessel (req-028)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await PUT(
      anfrage("PUT", { kind: "ki_suche", key: "sk-test-a3f9" }),
    );

    expect(response.status).toBe(401);
    expect(await accountApiKey(testDb.pool, ACCOUNT_ID, "ki_suche")).toBeNull();
  });

  it("weist eine Person ohne die Kennzeichnung Account-Admin ab", async () => {
    await angemeldetOhneKennzeichnung();

    const response = await PUT(
      anfrage("PUT", { kind: "ki_suche", key: "sk-test-a3f9" }),
    );

    expect(response.status).toBe(403);
    expect(await accountApiKey(testDb.pool, ACCOUNT_ID, "ki_suche")).toBeNull();
  });

  it("hinterlegt einen Schluessel und meldet seine letzten vier Zeichen", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage("PUT", { kind: "ki_suche", key: "sk-test-a3f9" }),
    );

    expect(response.status).toBe(200);
    expect(await zustand(response)).toEqual([
      { kind: "ki_suche", lastFour: "a3f9" },
      { kind: "google", lastFour: null },
    ]);
  });

  it("gibt den Schluessel selbst nie zurueck", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage("PUT", { kind: "ki_suche", key: "sk-test-a3f9" }),
    );

    expect(await response.text()).not.toContain("sk-test-a3f9");
  });

  it("ersetzt einen vorhandenen Schluessel", async () => {
    await angemeldet();
    await PUT(anfrage("PUT", { kind: "ki_suche", key: "sk-test-a3f9" }));

    const response = await PUT(
      anfrage("PUT", { kind: "ki_suche", key: "sk-neu-bbbb" }),
    );

    expect(await zustand(response)).toContainEqual({
      kind: "ki_suche",
      lastFour: "bbbb",
    });
    expect(await accountApiKey(testDb.pool, ACCOUNT_ID, "ki_suche")).toBe(
      "sk-neu-bbbb",
    );
  });

  it("weist eine unbekannte Art und einen leeren Schluessel ab", async () => {
    await angemeldet();

    expect(
      (await PUT(anfrage("PUT", { kind: "wetter", key: "sk-test" }))).status,
    ).toBe(400);
    expect(
      (await PUT(anfrage("PUT", { kind: "ki_suche", key: "   " }))).status,
    ).toBe(400);
  });

  it("legt ohne Geheimnis in der Umgebung nichts ab", async () => {
    await angemeldet();
    vi.stubEnv("AUTH_SECRET", "");

    const response = await PUT(
      anfrage("PUT", { kind: "ki_suche", key: "sk-test-a3f9" }),
    );

    expect(response.status).toBe(503);
  });
});

describe("DELETE /api/zugangsschluessel (req-028)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await DELETE(anfrage("DELETE", { kind: "ki_suche" }))).status).toBe(
      401,
    );
  });

  it("weist eine Person ohne die Kennzeichnung Account-Admin ab", async () => {
    await angemeldetOhneKennzeichnung();

    expect((await DELETE(anfrage("DELETE", { kind: "ki_suche" }))).status).toBe(
      403,
    );
  });

  it("entfernt einen Schluessel und meldet ihn als nicht gesetzt", async () => {
    await angemeldet();
    await PUT(anfrage("PUT", { kind: "ki_suche", key: "sk-test-a3f9" }));

    const response = await DELETE(anfrage("DELETE", { kind: "ki_suche" }));

    expect(response.status).toBe(200);
    expect(await zustand(response)).toContainEqual({
      kind: "ki_suche",
      lastFour: null,
    });
    expect(await accountApiKey(testDb.pool, ACCOUNT_ID, "ki_suche")).toBeNull();
  });
});
