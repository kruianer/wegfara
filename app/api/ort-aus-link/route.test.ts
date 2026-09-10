// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { GooglePlace } from "@/lib/google/types";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
const google = vi.hoisted(() => {
  const client = {
    resolveShortLink: vi.fn(),
    findPlace: vi.fn(),
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
// Externe Dienste werden in Tests gemockt (siehe stack.md, Testing).
vi.mock("@/lib/google/places-client", () => ({
  googlePlacesClient: google.factory,
}));

const { createSession } = await import("@/lib/db/sessions");
const { listPois } = await import("@/lib/db/pois");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { POST } = await import("./route");

const LINK =
  "https://www.google.com/maps/search/?api=1&query=Villa+Cimbrone&query_place_id=ChIJVillaCimbrone";

const VILLA_CIMBRONE: GooglePlace = {
  placeId: "ChIJVillaCimbrone",
  name: "Villa Cimbrone",
  address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
  position: { lat: 40.6491, lng: 14.6113 },
  types: ["tourist_attraction", "point_of_interest"],
  web: "https://villarufolo.com",
  description:
    "Historische Villa mit der Terrasse der Unendlichkeit über der Amalfiküste.",
  phone: "+39 089 857621",
  openingHours: ["Montag: 09:00–20:00"],
  rating: 4.6,
  ratingCount: 1240,
  photoNames: ["places/x/photos/a", "places/x/photos/b", "places/x/photos/c"],
};

/** Eine geglueckte Abfrage bei Google mit diesem Treffer (bug-026). */
function gefunden(place: GooglePlace | null) {
  return { ok: true as const, treffer: place };
}

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/ort-aus-link", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Angemeldet und mit hinterlegtem Zugangsschluessel fuer Google (req-028). */
async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
  await storeAccountApiKey(
    testDb.pool,
    ACCOUNT_ID,
    "google",
    "goo-gle-a3f9",
    new Date(),
  );
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  google.factory.mockClear();
  google.client.resolveShortLink.mockReset();
  google.client.findPlace.mockReset();
  google.client.placeDetails
    .mockReset()
    .mockResolvedValue(gefunden(VILLA_CIMBRONE));
});

describe("POST /api/ort-aus-link (req-048)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(anfrage({ link: LINK }));

    expect(response.status).toBe(401);
    expect(google.client.placeDetails).not.toHaveBeenCalled();
  });

  it("liefert die Angaben des Ortes für das Formular", async () => {
    await angemeldet();

    const response = await POST(anfrage({ link: LINK }));

    const body = await response.json();
    expect(body.result).toBe("gefunden");
    expect(body.ort).toMatchObject({
      placeId: "ChIJVillaCimbrone",
      name: "Villa Cimbrone",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      phone: "+39 089 857621",
      openingHours: "Montag: 09:00–20:00",
      bewertung: 4.6,
    });
  });

  it("füllt Kurz- und Langtext aus der Beschreibung bei Google (req-044)", async () => {
    await angemeldet();

    const response = await POST(anfrage({ link: LINK }));

    const ort = (await response.json()).ort;
    expect(ort.shortText).toBe(VILLA_CIMBRONE.description);
    expect(ort.longText).toBe(VILLA_CIMBRONE.description);
  });

  it("legt dabei keinen POI an — gespeichert wird erst das Formular", async () => {
    await angemeldet();
    const vorher = await listPois(testDb.pool, ACCOUNT_ID);

    await POST(anfrage({ link: LINK }));

    expect(await listPois(testDb.pool, ACCOUNT_ID)).toHaveLength(vorher.length);
  });

  it("nennt den Grund, wenn der Text kein Google-Maps-Link ist", async () => {
    await angemeldet();

    const response = await POST(anfrage({ link: "Villa Rufolo, Ravello" }));

    expect(await response.json()).toEqual({
      result: "fehler",
      reason: "kein_google_link",
    });
  });

  it("nennt den Grund, wenn die Abfrage bei Google fehlschlägt", async () => {
    await angemeldet();
    google.client.placeDetails.mockResolvedValue({
      ok: false,
      fehler: "abfrage_fehlgeschlagen",
    });

    const response = await POST(anfrage({ link: LINK }));

    expect((await response.json()).reason).toBe("abfrage_fehlgeschlagen");
  });

  it("nennt den Grund, wenn der Ort nicht zu finden ist", async () => {
    await angemeldet();
    google.client.placeDetails.mockResolvedValue(gefunden(null));

    const response = await POST(anfrage({ link: LINK }));

    expect((await response.json()).reason).toBe("ort_nicht_gefunden");
  });

  /**
   * Google weist den Schluessel des Accounts ab (bug-026): das ist etwas
   * anderes als ein Ort, den es nicht gibt, und muss auch so heissen --
   * sonst sucht der Nutzer den Fehler bei seinem Link.
   */
  it("nennt den abgewiesenen Zugangsschlüssel als eigenen Grund", async () => {
    await angemeldet();
    google.client.placeDetails.mockResolvedValue({
      ok: false,
      fehler: "zugang_abgelehnt",
    });

    const response = await POST(anfrage({ link: LINK }));

    expect(await response.json()).toEqual({
      result: "fehler",
      reason: "zugang_abgelehnt",
    });
  });

  /**
   * Der Fall aus bug-026: hinter dem Kurzlink steht die Feature-Kennung des
   * Ortes, keine Place-ID -- nachgeschlagen wird deshalb sein Name, in einem
   * einzigen Aufruf.
   */
  it("schlägt hinter einem Kurzlink den Namen nach, ohne zweiten Aufruf", async () => {
    await angemeldet();
    google.client.resolveShortLink.mockResolvedValue(
      "https://www.google.com/maps/place/inatura+-+Erlebnis+Naturschau+Dornbirn/@47.409286,9.7370139,17z/data=!4m6!3m5!1s0x479b6b4a8e60626b:0x53b81cddba9fa03a!8m2",
    );
    google.client.findPlace.mockResolvedValue(gefunden(VILLA_CIMBRONE));

    const response = await POST(
      anfrage({ link: "https://maps.app.goo.gl/AtmT9iWJpmweLMYk8" }),
    );

    expect(google.client.findPlace).toHaveBeenCalledWith(
      "inatura - Erlebnis Naturschau Dornbirn",
      { lat: 47.409286, lng: 9.7370139 },
    );
    expect(google.client.placeDetails).not.toHaveBeenCalled();
    expect((await response.json()).result).toBe("gefunden");
  });

  it("weist eine Anfrage ohne Link ab", async () => {
    await angemeldet();

    const response = await POST(anfrage({ link: " " }));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/ort-aus-link ohne Zugangsschlüssel (req-028)", () => {
  it("fragt bei Google gar nicht erst an", async () => {
    await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
    cookieJar.werte[SESSION_COOKIE] = "token-1";

    const response = await POST(anfrage({ link: LINK }));

    expect(response.status).toBe(409);
    expect(google.factory).not.toHaveBeenCalled();
    expect(google.client.placeDetails).not.toHaveBeenCalled();
  });

  it("fragt mit dem Schlüssel des eigenen Accounts an", async () => {
    await angemeldet();

    await POST(anfrage({ link: LINK }));

    expect(google.factory).toHaveBeenCalledWith("goo-gle-a3f9");
  });
});
