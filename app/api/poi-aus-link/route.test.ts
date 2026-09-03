// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
    findPlaceId: vi.fn(),
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
const { setPoiStatus } = await import("@/lib/db/pois");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { POST } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const LINK =
  "https://www.google.com/maps/search/?api=1&query=Villa+Cimbrone&query_place_id=ChIJVillaCimbrone";

// Ein Ort, den die Demodaten noch nicht kennen -- so entsteht ein neuer
// POI und nicht die Auffrischung eines vorhandenen.
const VILLA_CIMBRONE: GooglePlace = {
  placeId: "ChIJVillaCimbrone",
  name: "Villa Cimbrone",
  ort: "Ravello",
  address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
  position: { lat: 40.6491, lng: 14.6113 },
  types: ["tourist_attraction", "point_of_interest"],
  web: "https://villarufolo.com",
  phone: "+39 089 857621",
  openingHours: ["Montag: 09:00–20:00"],
  photoNames: ["places/x/photos/a", "places/x/photos/b", "places/x/photos/c"],
};

let bildablage: string;

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/poi-aus-link", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Angemeldet und mit hinterlegtem Zugangsschluessel fuer Google: ohne ihn
 * ist der Import gesperrt (req-028) -- das pruefen die beiden Tests am Ende
 * eigens.
 */
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
  bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.IMAGE_DIR = bildablage;
  google.factory.mockClear();
  google.client.resolveShortLink.mockReset();
  google.client.findPlaceId.mockReset();
  google.client.placeDetails.mockReset().mockResolvedValue(VILLA_CIMBRONE);
  google.client.fetchPhoto
    .mockReset()
    .mockResolvedValue(new Uint8Array([1, 2, 3]));
});

afterEach(async () => {
  await rm(bildablage, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("POST /api/poi-aus-link (req-026)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    expect(response.status).toBe(401);
    expect(google.client.placeDetails).not.toHaveBeenCalled();
  });

  it("legt den POI mit Name, Adresse, Telefon und Oeffnungszeiten an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    const body = await response.json();
    expect(body.result).toBe("angelegt");
    expect(body.poi).toMatchObject({
      name: "Villa Cimbrone",
      ort: "Ravello",
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      phone: "+39 089 857621",
      openingHours: ["Montag: 09:00–20:00"],
      status: "weiss_nicht",
    });
  });

  it("bildet die Art des Ortes auf einen POI-Typ ab", async () => {
    await angemeldet();
    google.client.placeDetails.mockResolvedValue({
      ...VILLA_CIMBRONE,
      types: ["restaurant", "food"],
    });

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    expect((await response.json()).poi.type).toBe("restaurant");
  });

  it("legt zu einem POI mit drei Fotos genau drei Dateien in der Bildablage ab", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    const body = await response.json();
    expect(body.poi.photos).toHaveLength(3);
    expect(await readdir(bildablage)).toHaveLength(3);
  });

  it("legt denselben Ort kein zweites Mal an, sondern frischt ihn auf", async () => {
    await angemeldet();
    await POST(anfrage({ tripId: SUEDITALIEN_ID, link: LINK }));

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    expect((await response.json()).result).toBe("aufgefrischt");
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    expect(pois.filter((p) => p.name === "Villa Cimbrone")).toHaveLength(1);
  });

  it("frischt einen bereits vorhandenen POI gleichen Namens auf", async () => {
    await angemeldet();
    // "Villa Rufolo" steht als POI der Suditalien-Rundreise in den
    // Demodaten -- ohne Kennung bei Google, da von Hand angelegt.
    google.client.placeDetails.mockResolvedValue({
      ...VILLA_CIMBRONE,
      placeId: "ChIJVillaRufolo",
      name: "Villa Rufolo",
    });

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    expect((await response.json()).result).toBe("aufgefrischt");
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    expect(pois.filter((p) => p.name === "Villa Rufolo")).toHaveLength(1);
  });

  it("laesst beim Auffrischen den Status unangetastet", async () => {
    await angemeldet();
    const erste = await POST(anfrage({ tripId: SUEDITALIEN_ID, link: LINK }));
    const poiId = (await erste.json()).poi.id;
    await setPoiStatus(testDb.pool, ACCOUNT_ID, poiId, "gesetzt");

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    expect((await response.json()).poi.status).toBe("gesetzt");
  });

  it("laesst beim Auffrischen keine abgeloeste Bilddatei zurueck", async () => {
    await angemeldet();
    await POST(anfrage({ tripId: SUEDITALIEN_ID, link: LINK }));

    await POST(anfrage({ tripId: SUEDITALIEN_ID, link: LINK }));

    expect(await readdir(bildablage)).toHaveLength(3);
  });

  it("legt zu einem Text, der kein Google-Maps-Link ist, keinen POI an", async () => {
    await angemeldet();
    const vorher = await listPois(testDb.pool, ACCOUNT_ID);

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: "Villa Rufolo, Ravello" }),
    );

    expect(await response.json()).toEqual({
      result: "fehler",
      reason: "kein_google_link",
    });
    expect(await listPois(testDb.pool, ACCOUNT_ID)).toHaveLength(vorher.length);
  });

  it("legt keinen POI an, wenn der Ort nicht zu finden ist", async () => {
    await angemeldet();
    google.client.placeDetails.mockResolvedValue(null);
    const vorher = await listPois(testDb.pool, ACCOUNT_ID);

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    expect((await response.json()).reason).toBe("abfrage_fehlgeschlagen");
    expect(await listPois(testDb.pool, ACCOUNT_ID)).toHaveLength(vorher.length);
  });

  it("legt den POI trotzdem an, wenn sich ein Foto nicht holen laesst", async () => {
    await angemeldet();
    google.client.fetchPhoto.mockResolvedValue(null);

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    const body = await response.json();
    expect(body.result).toBe("angelegt");
    expect(body.poi.photos).toEqual([]);
    expect(await readdir(bildablage)).toHaveLength(0);
  });

  it("legt keinen POI in einer Reise eines anderen Accounts an", async () => {
    await angemeldet();
    const accountId = randomUUID();
    const tripId = randomUUID();
    await testDb.pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [accountId, "Andere Person", "andere@example.com"],
    );
    await testDb.pool.query(
      `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
       values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
      [tripId, accountId],
    );

    const response = await POST(anfrage({ tripId, link: LINK }));

    expect(response.status).toBe(404);
    const { rows } = await testDb.pool.query(
      `select id from poi where trip_id = $1`,
      [tripId],
    );
    expect(rows).toHaveLength(0);
  });

  it("weist eine Anfrage ohne Link ab", async () => {
    await angemeldet();

    const response = await POST(anfrage({ tripId: SUEDITALIEN_ID, link: " " }));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/poi-aus-link ohne Zugangsschluessel (req-028)", () => {
  it("legt keinen POI an und fragt bei Google gar nicht erst an", async () => {
    await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
    cookieJar.werte[SESSION_COOKIE] = "token-1";
    const vorher = await listPois(testDb.pool, ACCOUNT_ID);

    const response = await POST(
      anfrage({ tripId: SUEDITALIEN_ID, link: LINK }),
    );

    expect(response.status).toBe(409);
    expect(google.factory).not.toHaveBeenCalled();
    expect(google.client.placeDetails).not.toHaveBeenCalled();
    expect(await listPois(testDb.pool, ACCOUNT_ID)).toHaveLength(vorher.length);
  });

  it("fragt mit dem Schluessel des eigenen Accounts an", async () => {
    await angemeldet();

    await POST(anfrage({ tripId: SUEDITALIEN_ID, link: LINK }));

    expect(google.factory).toHaveBeenCalledWith("goo-gle-a3f9");
  });
});
