// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { RECOVERY_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));

const { createAccessLink } = await import("@/lib/db/access-links");
const { createParticipant, findParticipantInAccount } = await import(
  "@/lib/db/participants"
);
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { findSessionByToken } = await import("@/lib/db/sessions");
const { GET } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date();

function aufruf(token: string) {
  const url = new URL("https://dev.wegfara.com/einladung");
  url.searchParams.set("token", token);
  return new Request(url, { headers: { "x-forwarded-proto": "https" } });
}

/** Clara Berger, der Reise zugeordnet und mit offener Einladung. */
async function claraMitEinladung(token: string) {
  const person = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    NOW,
  );
  await assignTripParticipant(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    person.id,
    "teilnehmer",
  );
  await createAccessLink(testDb.pool, person.id, token, NOW);
  return person;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  // Die Zieladresse stammt aus APP_URL, nicht aus der Adresse der Anfrage
  // (bug-008).
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("GET /einladung (req-023)", () => {
  it("meldet an, wer den Zugangslink aufruft", async () => {
    const person = await claraMitEinladung("token-1");

    const response = await GET(aufruf("token-1"));

    expect(response.status).toBe(303);
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    // Wer den Link einloest, wird zu genau dieser Person -- es entsteht kein
    // neuer, eigener Zugang.
    const session = await findSessionByToken(
      testDb.pool,
      cookie?.value ?? "",
      NOW,
    );
    expect(session?.participant.id).toBe(person.id);
  });

  it("fordert danach zum Einrichten eines Passkeys auf", async () => {
    await claraMitEinladung("token-1");

    const response = await GET(aufruf("token-1"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/einladung/passkey",
    );
  });

  it("gibt der eingeladenen Person damit Zugang zur Anwendung", async () => {
    const person = await claraMitEinladung("token-1");

    await GET(aufruf("token-1"));

    const nachher = await findParticipantInAccount(
      testDb.pool,
      ACCOUNT_ID,
      person.id,
    );
    expect(nachher?.loginEnabled).toBe(true);
  });

  it("meldet beim zweiten Aufruf desselben Links niemanden an", async () => {
    await claraMitEinladung("token-1");
    await GET(aufruf("token-1"));

    const response = await GET(aufruf("token-1"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung?fehler=einladung",
    );
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("meldet mit einem erfundenen Token niemanden an", async () => {
    const response = await GET(aufruf("ausgedacht"));

    expect(response.headers.get("location")).toContain("fehler=einladung");
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("zeigt einem Teilnehmer keine Notfallcodes", async () => {
    await claraMitEinladung("token-1");

    const response = await GET(aufruf("token-1"));

    expect(response.cookies.get(RECOVERY_COOKIE)).toBeUndefined();
  });

  it("zeigt einem Reiseleiter bei der ersten Anmeldung die Notfallcodes", async () => {
    await createAccessLink(testDb.pool, PARTICIPANT_ID, "token-leiter", NOW);

    const response = await GET(aufruf("token-leiter"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung/notfallcodes?weiter=%2Feinladung%2Fpasskey",
    );
    const codes = JSON.parse(
      decodeURIComponent(response.cookies.get(RECOVERY_COOKIE)?.value ?? "[]"),
    );
    expect(codes).toHaveLength(8);
  });

  it("leitet auf die konfigurierte Adresse, nicht auf die der Anfrage", async () => {
    // Hinter dem Cloudflare Tunnel traegt die eingehende Anfrage die interne
    // Adresse des Containers (bug-008).
    await claraMitEinladung("token-1");
    const intern = new URL("http://0.0.0.0:3000/einladung");
    intern.searchParams.set("token", "token-1");

    const response = await GET(
      new Request(intern, { headers: { "x-forwarded-proto": "https" } }),
    );

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/einladung/passkey",
    );
  });
});
