// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
import { SESSION_COOKIE } from "./cookies";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("../db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));
// next/navigation bricht die Seite mit einem Wurf ab; hier reicht ein Wurf,
// der das Ziel mitfuehrt.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { createParticipant } = await import("../db/participants");
const { assignTripParticipant } = await import("../db/trip-participants");
const { createSession, findSessionByToken } = await import("../db/sessions");
const { setTripState } = await import("../db/trips");
const { ACCOUNT_ID } = await import("../account");
const { currentSession, requireTripAccess } = await import("./current-session");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

/** Clara Berger, der Reise als Teilnehmerin zugeordnet und angemeldet. */
async function claraAngemeldet() {
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

describe("requireTripAccess (req-023)", () => {
  it("laesst den Reiseleiter durch, auch ohne freigegebene Reise", async () => {
    await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
    cookieJar.werte[SESSION_COOKIE] = "token-1";

    const session = await requireTripAccess();

    expect(session.participant.id).toBe(PARTICIPANT_ID);
  });

  it("laesst eine Teilnehmerin einer freigegebenen Reise durch", async () => {
    const clara = await claraAngemeldet();
    await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    const session = await requireTripAccess();

    expect(session.participant.id).toBe(clara.id);
  });

  it("fuehrt auf die Anmeldeseite und nennt den Grund", async () => {
    // Die Reise steht auf "In Planung" -- Clara hat nichts zu tun.
    await claraAngemeldet();

    await expect(requireTripAccess()).rejects.toThrow(
      "REDIRECT /anmeldung?fehler=keine-reise",
    );
  });

  it("beendet die Sitzung dabei wirklich", async () => {
    await claraAngemeldet();

    await expect(requireTripAccess()).rejects.toThrow();

    expect(
      await findSessionByToken(testDb.pool, "token-clara", new Date()),
    ).toBeNull();
    expect(await currentSession()).toBeNull();
  });

  it("fuehrt ohne Sitzung ohne Grund auf die Anmeldeseite", async () => {
    await expect(requireTripAccess()).rejects.toThrow("REDIRECT /anmeldung");
  });
});
