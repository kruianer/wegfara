// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { AiClient } from "@/lib/ai/client";
import type { GooglePlace } from "@/lib/google/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
// Externe Dienste werden in Tests gemockt (siehe stack.md, Testing) -- kein
// Test darf im Netz haengen oder Kosten verursachen.
const aussen = vi.hoisted(() => ({
  createOpenAiClient: vi.fn(),
  reverseGeocodeRegion: vi.fn(),
}));
const google = vi.hoisted(() => {
  const client = {
    resolveShortLink: vi.fn(),
    findPlace: vi.fn(),
    findPlaceInArea: vi.fn(),
    placeDetails: vi.fn(),
    fetchPhoto: vi.fn(),
  };
  return { client, factory: vi.fn(() => client) };
});

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
vi.mock("@/lib/google/places-client", () => ({
  googlePlacesClient: google.factory,
}));

const { createSession } = await import("@/lib/db/sessions");
const { setSearchArea } = await import("@/lib/db/search-area");
const { listPois } = await import("@/lib/db/pois");
const { createAccountWithFirstPerson } = await import(
  "@/lib/accounts/create-account"
);
const { createTrip, findTrip, updateTrip } = await import("@/lib/db/trips");
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

/** Eine geglueckte Abfrage bei Google mit diesem Treffer (bug-026). */
function gefunden(place: GooglePlace) {
  return { ok: true as const, treffer: place };
}

/** Ein Ort mitten im Suchgebiet, den die Demodaten noch nicht kennen. */
function villaCimbrone(overrides: Partial<GooglePlace> = {}): GooglePlace {
  return {
    placeId: "ChIJVillaCimbrone",
    name: "Villa Cimbrone",
    ort: "Ravello",
    address: "Via Santa Chiara 26, 84010 Ravello SA, Italien",
    position: { lat: 40.6491, lng: 14.6113 },
    types: ["tourist_attraction"],
    description: "Historische Villa mit Terrasse über der Amalfiküste.",
    rating: 4.6,
    ratingCount: 1240,
    photoNames: ["places/ChIJVillaCimbrone/photos/foto-1"],
    ...overrides,
  };
}

let bildverzeichnis: string;
/** Der zuletzt an die KI gestellte Prompt (siehe kiFindetEinenOrt). */
let zuletztGefragt = "";

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

/** Beide Zugangsschluessel des Accounts (req-028, req-057). */
async function schluesselHinterlegt(accountId = ACCOUNT_ID) {
  await storeAccountApiKey(
    testDb.pool,
    accountId,
    "ki_suche",
    "sk-test-a3f9",
    NOW,
  );
  await storeAccountApiKey(
    testDb.pool,
    accountId,
    "google",
    "goog-test-77b2",
    NOW,
  );
}

/** Die KI schlaegt Orte vor, die es in der Reise noch nicht gibt. */
function kiFindetEinenOrt(
  namen: string[] = ["Villa Cimbrone"],
  grund = "Passt zu eurem Interesse an Geschichte.",
) {
  // Der gestellte Prompt wird gemerkt: die Praeferenzen der Reise stehen
  // darin (req-057), und genau das prueft einer der Tests unten.
  const complete = vi.fn(async (prompt: string) => {
    zuletztGefragt = prompt;
    return JSON.stringify({ orte: namen.map((name) => ({ name, grund })) });
  });
  aussen.createOpenAiClient.mockImplementation(
    () => ({ complete }) as unknown as AiClient,
  );
  aussen.reverseGeocodeRegion.mockResolvedValue("Amalfiküste, Italien");
  google.client.findPlaceInArea.mockImplementation(async (name: string) =>
    gefunden(villaCimbrone({ placeId: `place-${name}`, name })),
  );
  google.client.fetchPhoto.mockResolvedValue(new Uint8Array([1, 2, 3]));
  return complete;
}

/** Setzt die Praeferenzen der geoeffneten Reise (req-057). */
async function mitPraeferenzen(
  praeferenzen: Partial<typeof LEERE_PRAEFERENZEN>,
) {
  const trip = await findTrip(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID);
  await updateTrip(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, {
    ...trip!,
    mainPlace: trip!.mainPlace,
    praeferenzen: { ...LEERE_PRAEFERENZEN, ...praeferenzen },
  });
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  aussen.createOpenAiClient.mockReset();
  aussen.reverseGeocodeRegion.mockReset();
  google.factory.mockClear();
  google.client.findPlaceInArea.mockReset();
  google.client.fetchPhoto.mockReset();
  bildverzeichnis = await mkdtemp(path.join(tmpdir(), "wegfara-poi-search-"));
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  vi.stubEnv("IMAGE_DIR", bildverzeichnis);
  await setSearchArea(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, GEBIET);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(bildverzeichnis, { recursive: true, force: true });
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

  /**
   * Seit req-057 werden die vorgeschlagenen Orte bei Google nachgeschlagen
   * -- ohne dessen Schluessel gaebe es weder Foto noch Bewertung.
   */
  it("sucht ohne Google-Schluessel gar nicht erst (req-057)", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    await storeAccountApiKey(
      testDb.pool,
      ACCOUNT_ID,
      "ki_suche",
      "sk-test-a3f9",
      NOW,
    );
    const vorher = (await listPois(testDb.pool, ACCOUNT_ID)).length;

    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(409);
    expect(((await response.json()) as { fehlt: string }).fehlt).toBe("google");
    expect(aussen.createOpenAiClient).not.toHaveBeenCalled();
    expect(await listPois(testDb.pool, ACCOUNT_ID)).toHaveLength(vorher);
  });

  it("legt mit hinterlegten Zugangsschluesseln POIs an", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    await schluesselHinterlegt();

    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(response.status).toBe(200);
    const { addedCount } = (await response.json()) as { addedCount: number };
    expect(addedCount).toBe(1);
    expect(
      (await listPois(testDb.pool, ACCOUNT_ID)).map((poi) => poi.name),
    ).toContain("Villa Cimbrone");
  });

  it("fragt mit den Schluesseln des eigenen Accounts an", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    await schluesselHinterlegt();

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(aussen.createOpenAiClient).toHaveBeenCalledWith({
      apiKey: "sk-test-a3f9",
    });
    expect(google.factory).toHaveBeenCalledWith("goog-test-77b2");
  });

  /**
   * Der Kern von req-028: der Schluessel des einen Accounts bezahlt nie die
   * Suche eines anderen.
   */
  it("greift nicht auf den Schluessel eines fremden Accounts zurueck", async () => {
    kiFindetEinenOrt();
    // Der Betreiber hat Schluessel hinterlegt; Anna nicht.
    await schluesselHinterlegt();
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
      tempo: "ausgewogen",
      praeferenzen: LEERE_PRAEFERENZEN,
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
  });

  it("sucht ohne gezeichnetes Suchgebiet nicht", async () => {
    await angemeldet();
    kiFindetEinenOrt();
    await schluesselHinterlegt();
    const ohneGebiet = await createTrip(testDb.pool, ACCOUNT_ID, {
      title: "Ohne Gebiet",
      startDate: "2027-07-01",
      endDate: "2027-07-08",
      mainPlace: { name: "Oberstdorf", lat: 47.4098, lng: 10.2794 },
      description: "",
      tempo: "ausgewogen",
      praeferenzen: LEERE_PRAEFERENZEN,
    });

    const response = await POST(anfrage({ tripId: ohneGebiet.id }));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/poi-search — die Angaben aus Google (req-057)", () => {
  beforeEach(async () => {
    await angemeldet();
    await schluesselHinterlegt();
  });

  it("legt zu jedem neuen POI Bewertung, Beschreibung und Begruendung ab", async () => {
    kiFindetEinenOrt(["Villa Cimbrone"], "Ruhige Gärten, wie ihr sie mögt.");

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    const poi = (await listPois(testDb.pool, ACCOUNT_ID)).find(
      (p) => p.name === "Villa Cimbrone",
    );
    expect(poi).toMatchObject({
      status: "weiss_nicht",
      ort: "Ravello",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      kiBegruendung: "Ruhige Gärten, wie ihr sie mögt.",
      shortText: "Historische Villa mit Terrasse über der Amalfiküste.",
      googlePlaceId: "place-Villa Cimbrone",
    });
  });

  it("legt zu jedem neuen POI genau ein Foto ab", async () => {
    kiFindetEinenOrt();
    google.client.fetchPhoto.mockResolvedValue(new Uint8Array([9, 9, 9]));

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    const poi = (await listPois(testDb.pool, ACCOUNT_ID)).find(
      (p) => p.name === "Villa Cimbrone",
    );
    expect(poi?.photos).toHaveLength(1);
    // Kein Bild ohne Datei und keine Datei ohne Datensatz (stack.md).
    expect(await readdir(bildverzeichnis)).toHaveLength(1);
  });

  it("legt einen POI auch dann an, wenn sich sein Foto nicht holen laesst", async () => {
    kiFindetEinenOrt();
    google.client.fetchPhoto.mockResolvedValue(null);

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    const poi = (await listPois(testDb.pool, ACCOUNT_ID)).find(
      (p) => p.name === "Villa Cimbrone",
    );
    expect(poi?.photos).toEqual([]);
    expect(await readdir(bildverzeichnis)).toHaveLength(0);
  });

  it("legt hoechstens zwanzig POIs je Lauf an", async () => {
    const namen = Array.from({ length: 30 }, (_, i) => `Ort ${i}`);
    kiFindetEinenOrt(namen);
    const vorher = (await listPois(testDb.pool, ACCOUNT_ID)).length;

    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(((await response.json()) as { addedCount: number }).addedCount).toBe(
      20,
    );
    expect(await listPois(testDb.pool, ACCOUNT_ID)).toHaveLength(vorher + 20);
  });

  it("legt keinen POI unterhalb der Mindestbewertung an", async () => {
    await mitPraeferenzen({ mindestbewertung: 4 });
    kiFindetEinenOrt(["Villa Cimbrone", "Schwacher Ort"]);
    google.client.findPlaceInArea.mockImplementation(async (name: string) =>
      gefunden(
        villaCimbrone({
          placeId: `place-${name}`,
          name,
          rating: name === "Schwacher Ort" ? 3.5 : 4.6,
        }),
      ),
    );

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    const namen = (await listPois(testDb.pool, ACCOUNT_ID)).map((p) => p.name);
    expect(namen).toContain("Villa Cimbrone");
    expect(namen).not.toContain("Schwacher Ort");
  });

  it("legt keinen POI ausserhalb des gezeichneten Suchgebiets an", async () => {
    kiFindetEinenOrt(["Villa Cimbrone", "Weit weg"]);
    google.client.findPlaceInArea.mockImplementation(async (name: string) =>
      gefunden(
        villaCimbrone({
          placeId: `place-${name}`,
          name,
          position:
            name === "Weit weg"
              ? { lat: 52.52, lng: 13.405 }
              : { lat: 40.6491, lng: 14.6113 },
        }),
      ),
    );

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    const namen = (await listPois(testDb.pool, ACCOUNT_ID)).map((p) => p.name);
    expect(namen).toContain("Villa Cimbrone");
    expect(namen).not.toContain("Weit weg");
  });

  it("legt bei einem zweiten Lauf keinen vorhandenen POI ein zweites Mal an", async () => {
    kiFindetEinenOrt();

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));
    const nachErstem = await listPois(testDb.pool, ACCOUNT_ID);
    await POST(anfrage({ tripId: SUEDITALIEN_ID }));
    const nachZweitem = await listPois(testDb.pool, ACCOUNT_ID);

    expect(nachZweitem).toHaveLength(nachErstem.length);
    expect(nachZweitem.filter((p) => p.name === "Villa Cimbrone")).toHaveLength(
      1,
    );
  });

  it("gibt der KI die Praeferenzen der Reise mit", async () => {
    await mitPraeferenzen({
      interessen: ["natur_wandern"],
      wertAuf: "wenig Trubel",
      nichtWollen: "keine Museen",
      mindestbewertung: 4,
    });
    kiFindetEinenOrt();

    await POST(anfrage({ tripId: SUEDITALIEN_ID }));

    expect(zuletztGefragt).toContain("Natur & Wandern");
    expect(zuletztGefragt).toContain("wenig Trubel");
    expect(zuletztGefragt).toContain("keine Museen");
    expect(zuletztGefragt).toContain("mindestens 4,0 von 5");
  });
});
