// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Mailer } from "@/lib/mail/mailer";

/**
 * Der ganze Weg einer Einladung ohne Passkey (req-085): Einladen aus "Wer
 * faehrt mit", Einloesen des Links, "Ohne Passkey weiter" -- und am
 * naechsten Tag die App wieder oeffnen. Dazwischen entsteht kein Passkey;
 * angemeldet haelt allein die Sitzung aus dem Einloesen.
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
// Die Schriften laedt nur Next selbst; hier genuegt der Name der Variablen.
vi.mock("next/font/google", () => {
  const schrift = () => ({ variable: "schrift" });
  return { Figtree: schrift, Playfair_Display: schrift };
});
// next/navigation bricht die Seite mit einem Wurf ab; hier reicht ein Wurf,
// der das Ziel mitfuehrt.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { createParticipant } = await import("@/lib/db/participants");
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { setTripState, listTripsForSession } = await import("@/lib/db/trips");
const { inviteTripParticipant } = await import(
  "@/lib/invitations/invite-trip-participant"
);
const { requireTripAccess } = await import("@/lib/auth/current-session");
const { POST: einloesen } = await import("@/app/api/auth/einladung/route");
const { default: EinladungPage } = await import("./page");
const { INVITATION_INVALID_NOTICE } = await import("@/lib/auth/messages");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const HEUTE = new Date("2026-10-25T18:00:00Z");
const MORGEN = new Date("2026-10-26T08:00:00Z");

const postfach: Mailer = { send: async () => true };

function tokenAus(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

function einloeseAnfrage(token: string) {
  const body = new FormData();
  body.set("token", token);
  return new Request("https://wegfara.com/api/auth/einladung", {
    method: "POST",
    body,
    headers: { "x-forwarded-proto": "https" },
  });
}

/** Anna mit Adresse, der Süditalien Rundreise zugeordnet. */
async function anna() {
  const person = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Anna",
      nickname: null,
      email: "anna@example.org",
      phone: null,
      iban: null,
    },
    HEUTE,
  );
  await assignTripParticipant(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    person.id,
    "teilnehmer",
  );
  return person;
}

async function eingeladen(participantId: string) {
  const result = await inviteTripParticipant(
    testDb.pool,
    postfach,
    ACCOUNT_ID,
    participantId,
    HEUTE,
  );
  return tokenAus(result!.invitation.url);
}

async function passkeysVon(participantId: string): Promise<number> {
  const { rows } = await testDb.pool.query(
    "select count(*) as anzahl from credential where participant_id = $1",
    [participantId],
  );
  return Number((rows[0] as { anzahl: string }).anzahl);
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("APP_URL", "https://wegfara.com");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HEUTE);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Ohne Passkey weiter (req-085)", () => {
  it("haelt Anna am naechsten Tag angemeldet und zeigt ihr die freigegebene Reise", async () => {
    const person = await anna();
    await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");
    const token = await eingeladen(person.id);

    const antwort = await einloesen(einloeseAnfrage(token));
    const sitzung = antwort.cookies.get(SESSION_COOKIE)?.value ?? "";
    expect(sitzung).not.toBe("");
    // "Ohne Passkey weiter": es entsteht keiner.
    expect(await passkeysVon(person.id)).toBe(0);

    // Die App wird geschlossen und am naechsten Tag wieder geoeffnet -- der
    // Browser bringt das Sitzungs-Cookie mit.
    vi.setSystemTime(MORGEN);
    cookieJar.werte[SESSION_COOKIE] = sitzung;
    const session = await requireTripAccess();

    expect(session.participant.id).toBe(person.id);
    const reisen = await listTripsForSession(testDb.pool, session);
    expect(reisen.map((reise) => reise.title)).toContain(
      "Süditalien Rundreise",
    );
  });

  it("haelt das Sitzungs-Cookie laenger als einen Tag", async () => {
    const person = await anna();
    await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    const antwort = await einloesen(
      einloeseAnfrage(await eingeladen(person.id)),
    );

    // Ohne maxAge verschwaende das Cookie beim Schliessen des Browsers.
    expect(antwort.cookies.get(SESSION_COOKIE)?.maxAge).toBeGreaterThan(
      24 * 60 * 60,
    );
  });
});

describe("Zweimal eingeladen (req-085)", () => {
  it("laesst Anna mit dem Link aus der ersten Mail nicht hinein", async () => {
    const person = await anna();
    await setTripState(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");
    const ersterLink = await eingeladen(person.id);
    await eingeladen(person.id);

    // Schon die Seite hinter dem Link schickt sie zur Anmeldung, mit dem
    // Hinweis auf die ungueltige Einladung.
    await expect(
      EinladungPage({ searchParams: Promise.resolve({ token: ersterLink }) }),
    ).rejects.toThrow("REDIRECT /anmeldung?fehler=einladung");

    // Und auch das Einloesen selbst meldet niemanden an.
    const antwort = await einloesen(einloeseAnfrage(ersterLink));
    expect(antwort.headers.get("location")).toBe(
      "https://wegfara.com/anmeldung?fehler=einladung",
    );
    expect(antwort.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("laesst sie mit dem Link aus der zweiten Mail hinein", async () => {
    const person = await anna();
    await eingeladen(person.id);
    const zweiterLink = await eingeladen(person.id);

    const antwort = await einloesen(einloeseAnfrage(zweiterLink));

    expect(antwort.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
  });

  it("sagt, dass der Link nicht mehr gueltig ist", () => {
    expect(INVITATION_INVALID_NOTICE).toContain("nicht mehr gültig");
    expect(INVITATION_INVALID_NOTICE).toContain("neuere Einladung");
  });
});
