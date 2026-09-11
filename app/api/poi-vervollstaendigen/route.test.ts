// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { GooglePlace } from "@/lib/google/types";
import type { Poi } from "@/lib/pois/types";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

/**
 * Google Places ist ein externer Dienst und wird gemockt (siehe stack.md,
 * Testing) -- kein Test haengt im Netz oder kostet Geld.
 */
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

vi.mock("@/lib/google/places-client", async (original) => ({
  ...(await original<typeof import("@/lib/google/places-client")>()),
  googlePlacesClient: google.factory,
}));
vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { createSession } = await import("@/lib/db/sessions");
const { createPoi, listPois, updatePoi } = await import("@/lib/db/pois");
const { listPhotosOfPoi, replacePoiPhotos } = await import(
  "@/lib/db/poi-photos"
);
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const VILLA_CIMBRONE: GooglePlace = {
  placeId: "ChIJVillaCimbrone",
  name: "Villa Cimbrone",
  address: "Via Santa Chiara 26, Ravello",
  position: { lat: 40.6465, lng: 14.6127 },
  types: ["tourist_attraction"],
  web: "https://villacimbrone.com",
  phone: "+39 089 857459",
  openingHours: ["Montag: 09:00–20:00"],
  description: "Gärten mit Meerblick über der Amalfiküste.",
  rating: 4.6,
  ratingCount: 1240,
  photoNames: ["places/x/photos/a", "places/x/photos/b"],
};

let bildablage: string;

function anfrage(body: unknown): Request {
  return new Request("https://dev.wegfara.com/api/poi-vervollstaendigen", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Angemeldet und mit hinterlegtem Zugangsschluessel fuer Google (req-028). */
async function mitGoogleSchluessel() {
  await angemeldet();
  await storeAccountApiKey(
    testDb.pool,
    ACCOUNT_ID,
    "google",
    "goo-gle-a3f9",
    new Date(),
  );
}

async function villaRufolo(): Promise<Poi> {
  const pois = await listPois(testDb.pool, ACCOUNT_ID);
  return pois.find((poi) => poi.name === "Villa Rufolo")!;
}

/**
 * Ein von Hand angelegter POI, wie ihn die Ortssuche hinterlaesst: ohne
 * Anschrift, ohne Texte, ohne Bewertung und ohne Fotos.
 */
async function leererPoi(): Promise<Poi> {
  const angelegt = await createPoi(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID, {
    name: "Villa Cimbrone",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6465, lng: 14.6127 },
    status: "weiss_nicht",
    web: null,
    shortText: null,
    longText: null,
    address: null,
    phone: null,
    openingHours: null,
    durationMinutes: null,
    kostenCent: null,
    buchung: "nicht_noetig",
  });
  return angelegt!;
}

async function gelesen(poiId: string): Promise<Poi> {
  const pois = await listPois(testDb.pool, ACCOUNT_ID);
  return pois.find((poi) => poi.id === poiId)!;
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  google.factory.mockClear();
  google.client.findPlace
    .mockReset()
    .mockResolvedValue({ ok: true, treffer: VILLA_CIMBRONE });
  google.client.placeDetails
    .mockReset()
    .mockResolvedValue({ ok: true, treffer: VILLA_CIMBRONE });
  google.client.fetchPhoto
    .mockReset()
    .mockResolvedValue(new Uint8Array([1, 2, 3]));
  bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.IMAGE_DIR = bildablage;
});

afterEach(async () => {
  await rm(bildablage, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("POST /api/poi-vervollstaendigen (req-061)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(anfrage({ poiId: "poi-1" }))).status).toBe(401);
  });

  it("vervollständigt einen POI eines anderen Accounts nicht (req-024)", async () => {
    await mitGoogleSchluessel();

    const response = await POST(
      anfrage({ poiId: "11111111-2222-3333-4444-555555555555" }),
    );

    expect(response.status).toBe(404);
  });

  it("fragt ohne hinterlegten Zugangsschlüssel gar nicht erst an (req-028)", async () => {
    await angemeldet();
    const villa = await villaRufolo();

    const response = await POST(anfrage({ poiId: villa.id }));

    expect(response.status).toBe(409);
    expect(google.client.findPlace).not.toHaveBeenCalled();
    expect(google.client.placeDetails).not.toHaveBeenCalled();
  });

  it("füllt die leere Adresse aus Google", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();

    const response = await POST(anfrage({ poiId: leer.id }));

    const body = (await response.json()) as { result: string; poi: Poi };
    expect(body.result).toBe("gefunden");
    expect(body.poi.address).toBe("Via Santa Chiara 26, Ravello");
    expect((await gelesen(leer.id)).address).toBe(
      "Via Santa Chiara 26, Ravello",
    );
  });

  it("lässt einen selbst geschriebenen Kurztext stehen", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();
    await updatePoi(testDb.pool, ACCOUNT_ID, leer.id, {
      name: leer.name,
      ort: leer.ort,
      type: leer.type,
      position: leer.position,
      status: leer.status,
      web: null,
      shortText: "Unser Lieblingsplatz",
      longText: null,
      address: null,
      phone: null,
      openingHours: null,
      durationMinutes: null,
      kostenCent: null,
      buchung: "nicht_noetig",
    });


    await POST(anfrage({ poiId: leer.id }));

    expect((await gelesen(leer.id)).shortText).toBe("Unser Lieblingsplatz");
  });

  it("nennt die gefüllten Angaben und vermerkt sie nicht als von Hand geändert", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();

    const response = await POST(anfrage({ poiId: leer.id }));

    const { gefuellt } = (await response.json()) as { gefuellt: string[] };
    expect(gefuellt).toContain("address");
    const { rows } = await testDb.pool.query(
      `select manual_fields from poi where id = $1`,
      [leer.id],
    );
    // Was aus Google kommt, gilt nicht als von Hand geändert (req-035).
    expect(rows[0].manual_fields).toBe("");
  });

  it("holt die Fotos, wenn der POI noch keine hat", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();

    const response = await POST(anfrage({ poiId: leer.id }));

    const { poi } = (await response.json()) as { poi: Poi };
    expect(poi.photos).toHaveLength(2);
    expect(await listPhotosOfPoi(testDb.pool, leer.id)).toHaveLength(2);
  });

  it("lässt eigene Bilder in Ruhe, wenn der POI schon welche hat", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();
    await replacePoiPhotos(testDb.pool, leer.id, ["eigenes.jpg"], new Date());

    await POST(anfrage({ poiId: leer.id }));

    expect(google.client.fetchPhoto).not.toHaveBeenCalled();
    expect(await listPhotosOfPoi(testDb.pool, leer.id)).toHaveLength(1);
  });

  it("schlägt über die gespeicherte Kennung nach, wenn es eine gibt", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();
    await testDb.pool.query(
      `update poi set google_place_id = 'ChIJVillaCimbrone' where id = $1`,
      [leer.id],
    );

    await POST(anfrage({ poiId: leer.id }));

    expect(google.client.placeDetails).toHaveBeenCalledWith(
      "ChIJVillaCimbrone",
    );
    expect(google.client.findPlace).not.toHaveBeenCalled();
  });

  it("nennt den Grund, wenn Google den Ort nicht kennt, und ändert nichts", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();
    google.client.findPlace.mockResolvedValue({ ok: true, treffer: null });

    const response = await POST(anfrage({ poiId: leer.id }));

    expect(await response.json()).toEqual({
      result: "fehler",
      reason: "ort_nicht_gefunden",
    });
    expect((await gelesen(leer.id)).address).toBeUndefined();
  });

  it("nennt den abgewiesenen Zugangsschlüssel als Grund", async () => {
    await mitGoogleSchluessel();
    const leer = await leererPoi();
    google.client.findPlace.mockResolvedValue({
      ok: false,
      fehler: "zugang_abgelehnt",
    });

    const response = await POST(anfrage({ poiId: leer.id }));

    expect(await response.json()).toEqual({
      result: "fehler",
      reason: "zugang_abgelehnt",
    });
  });
});
