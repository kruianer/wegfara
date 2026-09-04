// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDb, createTestDb } from "@/tests/test-db";
import { BOOTSTRAP_COOKIE, CHALLENGE_COOKIE } from "@/lib/auth/cookies";

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
  return new Request("https://dev.wegfara.com/api/auth/ersteinrichtung", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  cookieJar.werte = {};
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Ersteinrichtung (req-037)", () => {
  it("liefert einer leeren Umgebung eine Aufforderung", async () => {
    testDb.pool = await createEmptyTestDb();

    const response = await GET(anfrage());
    const options = (await response.json()) as {
      rp: { id: string };
      user: { name: string };
      authenticatorSelection: { residentKey: string; userVerification: string };
    };

    expect(response.status).toBe(200);
    expect(options.rp.id).toBe("dev.wegfara.com");
    // Der Betreiber wird unter seiner Adresse hinterlegt -- der
    // Wiederherstellungsweg steht damit ab der ersten Minute.
    expect(options.user.name).toBe("uwe@kremmel.org");
    expect(options.authenticatorSelection.residentKey).toBe("required");
    expect(options.authenticatorSelection.userVerification).toBe("required");
  });

  it("merkt sich die Kennung des kuenftigen Teilnehmers im Cookie", async () => {
    testDb.pool = await createEmptyTestDb();

    const response = await GET(anfrage());

    expect(response.cookies.get(BOOTSTRAP_COOKIE)?.value).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(response.cookies.get(CHALLENGE_COOKIE)?.value).toBeTruthy();
  });

  it("gibt es nicht mehr, sobald ein Teilnehmer existiert", async () => {
    // Auch nicht ueber die direkte URL: geprueft wird hier, nicht nur in der
    // Anzeige.
    testDb.pool = createTestDb();

    expect((await GET(anfrage())).status).toBe(404);
    expect((await POST(anfrage({ antwort: { id: "cred-1" } }))).status).toBe(
      404,
    );
  });

  it("legt ohne stimmige Antwort des Geraets nichts an", async () => {
    testDb.pool = await createEmptyTestDb();
    await GET(anfrage());
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";
    cookieJar.werte[BOOTSTRAP_COOKIE] = "0d2b1a3c-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

    const response = await POST(anfrage({ antwort: { id: "cred-1" } }));

    expect(response.status).toBe(400);
    const { rows } = await testDb.pool.query("select id from participant");
    expect(rows).toHaveLength(0);
  });

  it("legt nichts an, wenn die gemerkte Kennung fehlt oder unsinnig ist", async () => {
    testDb.pool = await createEmptyTestDb();
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";
    cookieJar.werte[BOOTSTRAP_COOKIE] = "'; drop table participant; --";

    const response = await POST(anfrage({ antwort: { id: "cred-1" } }));

    expect(response.status).toBe(400);
    const { rows } = await testDb.pool.query("select id from account");
    expect(rows).toHaveLength(0);
  });
});
