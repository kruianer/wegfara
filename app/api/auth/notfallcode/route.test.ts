// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PARTICIPANT_EMAIL,
  PARTICIPANT_ID,
  createTestDb,
} from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { LOGIN_FAILED_NOTICE } from "@/lib/auth/messages";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));

const { createRecoveryCodeSet } = await import("@/lib/auth/login");
const { POST } = await import("./route");

const NOW = new Date();

function anmeldung(email: string, code: string, weiter = "/go") {
  return new Request("https://dev.wegfara.com/api/auth/notfallcode", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ email, code, weiter }),
  });
}

/**
 * Jeder Test bekommt eine eigene Adresse, weil die Bremse der
 * Schnittstelle im Modul liegt und ueber Tests hinweg zaehlt.
 */
let laufendeNummer = 0;
async function eigenesKonto(): Promise<{ id: string; email: string }> {
  laufendeNummer += 1;
  const konto = {
    id: `00000000-0000-4000-8000-${String(laufendeNummer).padStart(12, "0")}`,
    email: `notfall-${laufendeNummer}@example.com`,
  };
  await testDb.pool.query(
    `insert into participant (id, account_id, name, email, created_at)
     select $1, account_id, name, $2, created_at from participant where id = $3`,
    [konto.id, konto.email, PARTICIPANT_ID],
  );
  return konto;
}

beforeEach(() => {
  testDb.pool = createTestDb();
});

describe("POST /api/auth/notfallcode (req-016)", () => {
  it("meldet mit einem notierten Notfallcode an", async () => {
    const codes = await createRecoveryCodeSet(testDb.pool, PARTICIPANT_ID, NOW);

    const response = await POST(anmeldung(PARTICIPANT_EMAIL, codes[0]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ weiter: "/go" });
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
  });

  it("meldet mit demselben Code kein zweites Mal an", async () => {
    const konto = await eigenesKonto();
    const codes = await createRecoveryCodeSet(testDb.pool, konto.id, NOW);
    await POST(anmeldung(konto.email, codes[0]));

    const response = await POST(anmeldung(konto.email, codes[0]));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: LOGIN_FAILED_NOTICE });
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("meldet mit einer unbekannten Adresse niemanden an", async () => {
    const codes = await createRecoveryCodeSet(testDb.pool, PARTICIPANT_ID, NOW);

    const response = await POST(anmeldung("fremd@example.com", codes[0]));

    expect(response.status).toBe(401);
  });

  it("meldet mit einem erfundenen Code niemanden an", async () => {
    await createRecoveryCodeSet(testDb.pool, PARTICIPANT_ID, NOW);

    const response = await POST(
      anmeldung((await eigenesKonto()).email, "AAAA-BBBB-CCCC"),
    );

    expect(response.status).toBe(401);
  });

  it("nimmt kein fremdes Ziel aus der Anfrage an", async () => {
    const konto = await eigenesKonto();
    const codes = await createRecoveryCodeSet(testDb.pool, konto.id, NOW);

    const response = await POST(
      anmeldung(konto.email, codes[0], "//fremde-seite.example"),
    );

    expect(await response.json()).toEqual({ weiter: "/" });
  });
});
