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
const { POST } = await import("./route");

function anfrage() {
  return new Request("https://dev.wegfara.com/api/auth/abmelden", {
    method: "POST",
    headers: { "x-forwarded-proto": "https" },
  });
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/auth/abmelden (req-016)", () => {
  it("beendet die Sitzung sofort", async () => {
    await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
    cookieJar.werte[SESSION_COOKIE] = "token-1";

    await POST(anfrage());

    expect(
      await findSessionByToken(testDb.pool, "token-1", new Date()),
    ).toBeNull();
  });

  it("loescht das Sitzungs-Cookie", async () => {
    await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
    cookieJar.werte[SESSION_COOKIE] = "token-1";

    const response = await POST(anfrage());

    expect(response.cookies.get(SESSION_COOKIE)?.maxAge).toBe(0);
  });

  it("laesst die Sitzung eines anderen Geraets bestehen", async () => {
    const now = new Date();
    await createSession(testDb.pool, PARTICIPANT_ID, "token-1", now);
    await createSession(testDb.pool, PARTICIPANT_ID, "token-2", now);
    cookieJar.werte[SESSION_COOKIE] = "token-1";

    await POST(anfrage());

    expect(
      await findSessionByToken(testDb.pool, "token-2", now),
    ).not.toBeNull();
  });

  it("kommt auch ohne bestehende Sitzung ohne Fehler zurecht", async () => {
    const response = await POST(anfrage());

    expect(response.status).toBe(200);
  });
});
