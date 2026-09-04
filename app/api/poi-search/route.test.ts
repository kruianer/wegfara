// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { AiClient } from "@/lib/ai/client";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
// Externe Dienste werden in Tests gemockt (siehe stack.md, Testing) -- kein
// Test darf im Netz haengen oder Kosten verursachen.
const aussen = vi.hoisted(() => ({
  createOpenAiClient: vi.fn(),
  reverseGeocodeRegion: vi.fn(),
  findPlace: vi.fn(),
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));
vi.mock("@/lib/ai/openai-client", () => ({
  createOpenAiClient: aussen.createOpenAiClient,
}));
vi.mock("@/lib/osm/reverse-geocode", () => ({
  reverseGeocodeRegion: aussen.reverseGeocodeRegion,
}));
vi.mock("@/lib/osm/overpass-client", () => ({ findPlace: aussen.findPlace }));

const { createSession } = await import("@/lib/db/sessions");
const { setSearchArea } = await import("@/lib/db/search-area");
const { listPois } = await import("@/lib/db/pois");
const { createAccountWithFirstPerson } = await import(
  "@/lib/accounts/create-account"
);
const { createTrip } = await import("@/lib/db/trips");
const { enableLogin, listParticipants } = await import("@/lib/db/participants");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { POST } = await import("./route");

const NOW = new Date("2026-09-03T10:00:00Z");
const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const GEBIET = [
  { lat: 40.6, lng: 14.5 },
  { lat: 40.7, lng: 14.5 },
  { lat: 40.7, lng: 14.7 },
  { lat: 40.6, lng: 14.7 },
];

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/poi-search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Der Betreiber -- Account-Admin seines Accounts (req-027). */
async function angemeldet(token = "token-1") {
  await createSession(testDb.pool, PARTICIPANT_ID, token, NOW);
  cookieJar.werte[SESSION_COOKIE] = token;
}

/** Die KI schlaegt genau einen Ort vor, den es noch nicht gibt. */
function kiFindetEinenOrt() {
  const complete = vi.fn(async () => '{"names": ["Villa Cimbrone"]}');
  aussen.createOpenAiClient.mockImplementation(
    () => ({ complete }) as unknown as AiClient,
  );
  aussen.reverseGeocodeRegion.mockResolvedValue("Amalfiküste, Italien");
  aussen.findPlace.mockResolvedValue({
    name: "Villa Cimbrone",
    ort: "Ravello",
    position: { lat: 40.6491, lng: 14.6113 },
    type: "sehenswuerdigkeit",
  });
  return complete;
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  aussen.createOpenAiClient.mockReset();
  aussen.reverseGeocodeRegion.mockReset();
  aussen.findPlace.mockReset();
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  await setSearchArea(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, GEBIET);
});

describe("POST /api/poi-search (req-014, req-028)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(401);
  });

  it("sucht ohne hinterlegten Zugangsschluessel gar nicht erst", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    const vorher = (await listPois(testDb.pool, ACCOUNT_ID)).length;

    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(409);
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
    expect(aussen.reverseGeocodeRegion).not.toHaveBeenCalled();
    expect(await listPois(testDb.pool, ACCOUNT_ID)).toHaveLength(vorher);
  });

  it("legt mit hinterlegtem Zugangsschluessel POIs an", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    await storeAccountApiKey(
      testDb.pool,
      ACCOUNT_ID,
      "ki_suche",
      "sk-test-a3f9",
      NOW,
    );

    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(200);
    const { addedCount } = (await response.json()) as { addedCount: number };
    expect(addedCount).toBe(1);
    expect(
      (await listPois(testDb.pool, ACCOUNT_ID)).map((poi) => poi.name),
    ).toContain("Villa Cimbrone");
  });

  it("fragt mit dem Schluessel des eigenen Accounts an", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    await storeAccountApiKey(
      testDb.pool,
      ACCOUNT_ID,
      "ki_suche",
      "sk-test-a3f9",
      NOW,
    );

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(aussen.createOpenAiClient).toHaveBeenCalledWith({
      apiKey: "sk-test-a3f9",
    });
  });

  /**
   * Der Kern von req-028: der Schluessel des einen Accounts bezahlt nie die
   * Suche eines anderen.
   */
  it("greift nicht auf den Schluessel eines fremden Accounts zurueck", async () => {
    kiFindetEinenOrt();
    // Der Betreiber hat einen Schluessel hinterlegt; Anna nicht.
    await storeAccountApiKey(
      testDb.pool,
      ACCOUNT_ID,
      "ki_suche",
      "sk-test-a3f9",
      NOW,
    );
    const account = await createAccountWithFirstPerson(
      testDb.pool,
      {
        name: "Familie Huber",
        personName: "Anna Huber",
        personEmail: "anna@huber.de",
      },
      NOW,
    );
    const anna = (await listParticipants(testDb.pool, account!.id))[0];
    await enableLogin(testDb.pool, anna.id);
    const ihre = await createTrip(testDb.pool, account!.id, {
      title: "Allgäu 2027",
      startDate: "2027-07-01",
      endDate: "2027-07-08",
      mainPlace: { name: "Oberstdorf", lat: 47.4098, lng: 10.2794 },
      description: "",
    });
    await setSearchArea(testDb.pool, account!.id, ihre.id, GEBIET);
    await createSession(testDb.pool, anna.id, "token-anna", NOW);
    cookieJar.werte[SESSION_COOKIE] = "token-anna";

    const response = await POST(anfrage({ tripId: ihre.id }));

    expect(response.status).toBe(409);
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
  });

  it("greift nicht auf den Schluessel aus den Umgebungsvariablen zurueck", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    vi.stubEnv("OPENAI_API_KEY", "schluessel-der-umgebung");

    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(409);
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
