// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createEmptyTestDb, createTestDb } from "@/tests/test-db";

/**
 * **Keine offene Selbstregistrierung** (req-038): weitere Personen kommen
 * ausschliesslich ueber eine Einladung herein. Ein Versuch, sich ohne
 * Einladung zu registrieren, wird abgewiesen.
 *
 * Dieser Test nimmt sich die beiden Wege vor, ueber die ein Konto entstehen
 * kann -- das Einrichten eines Passkeys und die Ersteinrichtung -- und haelt
 * fest, dass keiner von beiden ohne Einladung offensteht.
 */

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

const passkey = await import("@/app/api/auth/passkey/registrierung/route");
const ersteinrichtung = await import("@/app/api/auth/ersteinrichtung/route");
const { listParticipants } = await import("@/lib/db/participants");

function anfrage(url: string, body?: unknown) {
  return new Request(`https://dev.wegfara.com${url}`, {
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

describe("Kein Zugang ohne Einladung (req-038)", () => {
  it("richtet ohne Anmeldung keinen Passkey ein", async () => {
    testDb.pool = createTestDb();

    expect(
      (await passkey.GET(anfrage("/api/auth/passkey/registrierung"))).status,
    ).toBe(401);
    expect(
      (
        await passkey.POST(
          anfrage("/api/auth/passkey/registrierung", { antwort: {} }),
        )
      ).status,
    ).toBe(401);
  });

  it("legt ohne Anmeldung kein Konto an", async () => {
    testDb.pool = createTestDb();
    const vorher = await listParticipants(testDb.pool, ACCOUNT_ID);

    await passkey.POST(
      anfrage("/api/auth/passkey/registrierung", { antwort: {} }),
    );

    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(
      vorher.length,
    );
  });

  it("weist die Ersteinrichtung ab, sobald es eine Person gibt", async () => {
    // Sie existiert nur, solange die Installation leer ist (req-037) --
    // danach waere sie eine offene Registrierung.
    testDb.pool = createTestDb();

    expect(
      (await ersteinrichtung.GET(anfrage("/api/auth/ersteinrichtung"))).status,
    ).toBe(404);
    expect(
      (
        await ersteinrichtung.POST(
          anfrage("/api/auth/ersteinrichtung", { antwort: {} }),
        )
      ).status,
    ).toBe(404);
  });

  it("laesst die Ersteinrichtung nur in einer leeren Umgebung zu (req-037)", async () => {
    testDb.pool = await createEmptyTestDb();

    expect(
      (await ersteinrichtung.GET(anfrage("/api/auth/ersteinrichtung"))).status,
    ).toBe(200);
  });
});
