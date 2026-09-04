// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
import { CHALLENGE_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

/**
 * Die Antwort eines echten Geraets laesst sich hier nicht erzeugen -- an
 * ihrer Stelle steht bei Bedarf diese Pruefung. Ohne sie laeuft die echte.
 */
const webauthn = vi.hoisted(() => ({
  pruefung: null as
    | null
    | ((options: Record<string, unknown>) => Promise<unknown> | unknown),
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));
vi.mock("@simplewebauthn/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@simplewebauthn/server")>();
  return {
    ...actual,
    verifyRegistrationResponse: async (
      options: Parameters<typeof actual.verifyRegistrationResponse>[0],
    ) =>
      webauthn.pruefung
        ? webauthn.pruefung(options as unknown as Record<string, unknown>)
        : actual.verifyRegistrationResponse(options),
  };
});

const { createSession } = await import("@/lib/db/sessions");
const { listCredentials } = await import("@/lib/db/credentials");
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
  webauthn.pruefung = null;
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
      authenticatorSelection: { residentKey: string; userVerification: string };
    };

    expect(options.rp.id).toBe("dev.wegfara.com");
    expect(options.user.name).toBe("uwe@kremmel.org");
    // Der Passkey muss auf dem Geraet auffindbar sein, sonst koennte die
    // Anmeldeseite ihn nicht ohne Eingabe anbieten.
    expect(options.authenticatorSelection.residentKey).toBe("required");
    // Ein Passkey ohne biometrische Pruefung waere nur ein Geraetenachweis
    // (req-037).
    expect(options.authenticatorSelection.userVerification).toBe("required");
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

describe("Ein Passkey pro Geraet (req-037)", () => {
  /** Ein Geraet, dessen Antwort die Pruefung besteht. */
  function geraetAntwortet(id: string) {
    webauthn.pruefung = (options) => {
      geraetAntwortet.uebergeben = options;
      return {
        verified: true,
        registrationInfo: {
          credential: {
            id,
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ["internal"],
          },
        },
      };
    };
  }
  geraetAntwortet.uebergeben = {} as Record<string, unknown>;

  it("verlangt die biometrische Pruefung auch nachgewiesen", async () => {
    await angemeldet();
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";
    geraetAntwortet("cred-windows");

    await POST(anfrage({ antwort: { id: "cred-windows" } }));

    expect(geraetAntwortet.uebergeben.requireUserVerification).toBe(true);
  });

  it("legt neben dem vorhandenen Passkey einen weiteren an", async () => {
    // iPhone und Windows-PC bekommen jeweils einen eigenen: Windows Hello
    // synchronisiert nicht ueber den iCloud-Schluesselbund.
    await angemeldet();
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
      new Date(),
    );
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";
    geraetAntwortet("cred-windows");

    const response = await POST(
      anfrage({ antwort: { id: "cred-windows" }, bezeichnung: "Windows-PC" }),
    );

    expect(response.status).toBe(200);
    expect(
      (await listCredentials(testDb.pool, PARTICIPANT_ID)).map((c) => c.label),
    ).toEqual(["iPhone", "Windows-PC"]);
  });

  it("liefert das Hinzugefuegt-am fertig fuer Meine Geraete", async () => {
    await angemeldet();
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";
    geraetAntwortet("cred-windows");

    const body = (await (
      await POST(anfrage({ antwort: { id: "cred-windows" } }))
    ).json()) as { hinzugefuegtAm: string };

    expect(body.hinzugefuegtAm).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });
});
