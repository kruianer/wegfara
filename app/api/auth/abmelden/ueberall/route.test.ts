// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
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
const { POST } = await import("./route");

const NOW = new Date("2026-09-04T12:00:00Z");

function anfrage() {
  return new Request("https://dev.wegfara.com/api/auth/abmelden/ueberall", {
    method: "POST",
    headers: { "x-forwarded-proto": "https" },
  });
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("Ueberall abmelden (req-037)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(anfrage())).status).toBe(401);
  });

  it("beendet alle Sitzungen -- auch die, an der ich gerade sitze", async () => {
    await createSession(testDb.pool, PARTICIPANT_ID, "token-iphone", NOW);
    await createSession(testDb.pool, PARTICIPANT_ID, "token-laptop", NOW);
    cookieJar.werte[SESSION_COOKIE] = "token-laptop";

    const response = await POST(anfrage());

    expect(response.status).toBe(200);
    expect(
      await findSessionByToken(testDb.pool, "token-iphone", NOW),
    ).toBeNull();
    expect(
      await findSessionByToken(testDb.pool, "token-laptop", NOW),
    ).toBeNull();
  });

  it("loescht das Sitzungs-Cookie dieses Geraets", async () => {
    await createSession(testDb.pool, PARTICIPANT_ID, "token-laptop", NOW);
    cookieJar.werte[SESSION_COOKIE] = "token-laptop";

    const response = await POST(anfrage());

    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });

  it("laesst die Passkeys bestehen -- es ist kein Aussperren", async () => {
    await createCredential(
      testDb.pool,
      {
        id: "cred-iphone",
        participantId: PARTICIPANT_ID,
        publicKey: "schluessel",
        counter: 0,
        transports: [],
        label: "iPhone",
      },
      NOW,
    );
    await createSession(
      testDb.pool,
      PARTICIPANT_ID,
      "token-iphone",
      NOW,
      "cred-iphone",
    );
    cookieJar.werte[SESSION_COOKIE] = "token-iphone";

    await POST(anfrage());

    expect(await listCredentials(testDb.pool, PARTICIPANT_ID)).toHaveLength(1);
  });
});
