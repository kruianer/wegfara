// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/tests/test-db";
import { CHALLENGE_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";
import { PASSKEY_FAILED_NOTICE } from "@/lib/auth/messages";

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

const { GET, POST } = await import("./route");

function anfrage(body?: unknown) {
  return new Request("https://dev.wegfara.com/api/auth/passkey/anmeldung", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("GET /api/auth/passkey/anmeldung (req-016)", () => {
  it("liefert eine Aufforderung fuer die Domain der Umgebung", async () => {
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");

    const response = await GET(anfrage());
    const options = (await response.json()) as {
      rpId: string;
      challenge: string;
      allowCredentials?: unknown[];
    };

    expect(options.rpId).toBe("dev.wegfara.com");
    expect(options.challenge).toBeTruthy();
    // Ohne allowCredentials sucht der Browser den passenden Passkey selbst
    // — die Anmeldung im Alltag kommt so ohne Eingabe aus.
    expect(options.allowCredentials).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("merkt sich die Aufforderung geschuetzt im Cookie", async () => {
    const response = await GET(anfrage());
    const cookie = response.cookies.get(CHALLENGE_COOKIE);

    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
  });

  it("liefert bei jedem Aufruf eine neue Aufforderung", async () => {
    const erste = (await (await GET(anfrage())).json()) as {
      challenge: string;
    };
    const zweite = (await (await GET(anfrage())).json()) as {
      challenge: string;
    };

    expect(erste.challenge).not.toBe(zweite.challenge);
  });
});

describe("POST /api/auth/passkey/anmeldung (req-016)", () => {
  it("meldet ohne vorherige Aufforderung niemanden an", async () => {
    const response = await POST(anfrage({ antwort: { id: "cred-1" } }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: PASSKEY_FAILED_NOTICE });
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("meldet mit einem unbekannten Passkey niemanden an", async () => {
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";

    const response = await POST(anfrage({ antwort: { id: "cred-fremd" } }));

    expect(response.status).toBe(401);
  });

  it("entwertet die Aufforderung auch nach einem Fehlversuch", async () => {
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";

    const response = await POST(anfrage({ antwort: { id: "cred-fremd" } }));

    expect(response.cookies.get(CHALLENGE_COOKIE)?.maxAge).toBe(0);
  });

  it("meldet ohne Antwort des Geraets niemanden an", async () => {
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";

    const response = await POST(anfrage({}));

    expect(response.status).toBe(401);
  });
});
