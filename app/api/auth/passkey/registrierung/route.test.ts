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

const { createSession } = await import("@/lib/db/sessions");
const { createCredential } = await import("@/lib/db/credentials");
const { GET, POST } = await import("./route");

function anfrage(body?: unknown) {
  return new Request("https://dev.wegfara.com/api/auth/passkey/registrierung", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("Passkey einrichten (req-016)", () => {
  it("verlangt eine Anmeldung — die erste laeuft ueber den Anmeldelink", async () => {
    expect((await GET(anfrage())).status).toBe(401);
    expect((await POST(anfrage({}))).status).toBe(401);
  });

  it("liefert eine Aufforderung fuer das angemeldete Konto", async () => {
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");
    await angemeldet();

    const options = (await (await GET(anfrage())).json()) as {
      rp: { id: string; name: string };
      user: { name: string };
      authenticatorSelection: { residentKey: string };
    };

    expect(options.rp.id).toBe("dev.wegfara.com");
    expect(options.user.name).toBe("uwe@kremmel.org");
    // Der Passkey muss auf dem Geraet auffindbar sein, sonst koennte die
    // Anmeldeseite ihn nicht ohne Eingabe anbieten.
    expect(options.authenticatorSelection.residentKey).toBe("required");
    vi.unstubAllEnvs();
  });

  it("schliesst bereits hinterlegte Passkeys aus", async () => {
    await angemeldet();
    await createCredential(
      testDb.pool,
      {
        id: "cred-1",
        participantId: PARTICIPANT_ID,
        publicKey: "schluessel",
        counter: 0,
        transports: [],
        label: "Telefon",
      },
      new Date(),
    );

    const options = (await (await GET(anfrage())).json()) as {
      excludeCredentials: { id: string }[];
    };

    expect(options.excludeCredentials.map((c) => c.id)).toEqual(["cred-1"]);
  });

  it("hinterlegt nichts, wenn die Antwort des Geraets nicht stimmt", async () => {
    await angemeldet();

    const response = await POST(anfrage({ antwort: { id: "cred-1" } }));

    expect(response.status).toBe(400);
    const { rows } = await testDb.pool.query("select id from credential");
    expect(rows).toHaveLength(0);
  });
});
