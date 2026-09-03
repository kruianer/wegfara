// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { RECOVERY_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";

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
const { countUnusedRecoveryCodes } = await import("@/lib/db/recovery-codes");
const { createParticipant } = await import("@/lib/db/participants");
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { GET, POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const CODES = ["ABCD-EFGH-JKLM", "NPQR-STUV-WXYZ"];

function anfrage() {
  return new Request("https://dev.wegfara.com/api/auth/notfallcodes", {
    headers: { "x-forwarded-proto": "https" },
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Clara Berger meldet sich an -- Teilnehmerin, nicht Reiseleiterin. */
async function alsTeilnehmerinAngemeldet() {
  const clara = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    new Date(),
  );
  await assignTripParticipant(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    clara.id,
    "teilnehmer",
  );
  await createSession(testDb.pool, clara.id, "token-clara", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-clara";
  return clara;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("GET /api/auth/notfallcodes (req-016)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET(anfrage())).status).toBe(401);
  });

  it("liefert die frisch erzeugten Codes ein einziges Mal", async () => {
    await angemeldet();
    cookieJar.werte[RECOVERY_COOKIE] = JSON.stringify(CODES);

    const response = await GET(anfrage());

    expect(await response.json()).toEqual({ codes: CODES });
    // Beim Ausliefern werden sie verworfen — ein erneuter Aufruf der Seite
    // zeigt sie nicht noch einmal.
    expect(response.cookies.get(RECOVERY_COOKIE)?.maxAge).toBe(0);
  });

  it("liefert nichts mehr, wenn sie schon angezeigt wurden", async () => {
    await angemeldet();

    expect(await (await GET(anfrage())).json()).toEqual({ codes: null });
  });
});

describe("POST /api/auth/notfallcodes (req-016)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST()).status).toBe(401);
  });

  it("erzeugt einen neuen Satz von acht Codes", async () => {
    await angemeldet();

    const body = (await (await POST()).json()) as {
      codes: string[];
      offen: number;
    };

    expect(body.codes).toHaveLength(8);
    expect(body.offen).toBe(8);
    expect(await countUnusedRecoveryCodes(testDb.pool, PARTICIPANT_ID)).toBe(8);
  });

  it("ersetzt den alten Satz vollstaendig", async () => {
    await angemeldet();
    const alt = (await (await POST()).json()) as { codes: string[] };

    const neu = (await (await POST()).json()) as { codes: string[] };

    expect(neu.codes).not.toEqual(alt.codes);
    expect(await countUnusedRecoveryCodes(testDb.pool, PARTICIPANT_ID)).toBe(8);
  });

  // req-023: Teilnehmer erhalten keine Notfallcodes. Die Pruefung steht in
  // der Schnittstelle, nicht nur in der Anzeige -- ein Aufruf an der
  // Kontoseite vorbei kaeme sonst doch zu einem Satz.
  it("erzeugt fuer einen Teilnehmer keine Codes (req-023)", async () => {
    const clara = await alsTeilnehmerinAngemeldet();

    const response = await POST();

    expect(response.status).toBe(403);
    expect(await countUnusedRecoveryCodes(testDb.pool, clara.id)).toBe(0);
  });
});
