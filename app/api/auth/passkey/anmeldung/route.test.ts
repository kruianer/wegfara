// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
import { CHALLENGE_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";
import { PASSKEY_FAILED_NOTICE } from "@/lib/auth/messages";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

/**
 * Die Antwort eines echten Geraets laesst sich hier nicht erzeugen -- an
 * ihrer Stelle steht bei Bedarf diese Pruefung. Ohne sie laeuft die echte,
 * damit die uebrigen Faelle unveraendert bleiben.
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
    verifyAuthenticationResponse: async (
      options: Parameters<typeof actual.verifyAuthenticationResponse>[0],
    ) =>
      webauthn.pruefung
        ? webauthn.pruefung(options as unknown as Record<string, unknown>)
        : actual.verifyAuthenticationResponse(options),
  };
});

const { createCredential, findCredentialById } = await import(
  "@/lib/db/credentials"
);
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
  webauthn.pruefung = null;
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

  // req-037: sonst gibt ein Geraet den Passkey unter Umstaenden ohne Face ID
  // / Touch ID / Windows Hello frei, und der Schutz waere nur die
  // Geraetenaehe.
  it("verlangt die biometrische Pruefung (req-037)", async () => {
    const options = (await (await GET(anfrage())).json()) as {
      userVerification: string;
    };

    expect(options.userVerification).toBe("required");
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

describe("POST /api/auth/passkey/anmeldung (req-037)", () => {
  const NOW = new Date("2026-09-04T12:00:00Z");

  /** Ein hinterlegter Passkey, mit dem sich das iPhone anmeldet. */
  async function iphoneHinterlegt() {
    await createCredential(
      testDb.pool,
      {
        id: "cred-iphone",
        participantId: PARTICIPANT_ID,
        publicKey: "oeffentlicher-schluessel",
        counter: 0,
        transports: ["internal"],
        label: "iPhone",
      },
      NOW,
    );
    cookieJar.werte[CHALLENGE_COOKIE] = "aufforderung";
  }

  it("verlangt die biometrische Pruefung auch nachgewiesen", async () => {
    await iphoneHinterlegt();
    let uebergeben: Record<string, unknown> = {};
    webauthn.pruefung = (options) => {
      uebergeben = options;
      return { verified: true, authenticationInfo: { newCounter: 1 } };
    };

    await POST(anfrage({ antwort: { id: "cred-iphone" } }));

    // Ein Geraet, das die Pruefung ueberspringt, wird abgelehnt (req-037).
    expect(uebergeben.requireUserVerification).toBe(true);
  });

  it("schreibt Zuletzt-verwendet fort und bindet die Sitzung an den Passkey", async () => {
    await iphoneHinterlegt();
    webauthn.pruefung = () => ({
      verified: true,
      authenticationInfo: { newCounter: 4 },
    });

    const response = await POST(anfrage({ antwort: { id: "cred-iphone" } }));

    expect(response.status).toBe(200);
    expect(
      (await findCredentialById(testDb.pool, "cred-iphone"))?.lastUsedAt,
    ).not.toBeNull();
    const { rows } = await testDb.pool.query(
      "select credential_id from session",
    );
    expect(rows[0].credential_id).toBe("cred-iphone");
  });

  it("meldet niemanden an, wenn das Geraet die Pruefung ueberspringt", async () => {
    await iphoneHinterlegt();
    // So verhaelt sich die echte Pruefung bei fehlendem User-Verification-Bit.
    webauthn.pruefung = () => {
      throw new Error(
        "User verification required, but user could not be verified",
      );
    };

    const response = await POST(anfrage({ antwort: { id: "cred-iphone" } }));

    expect(response.status).toBe(401);
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});
