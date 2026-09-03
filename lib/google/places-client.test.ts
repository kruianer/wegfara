// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchGooglePhoto,
  fetchGooglePlaceDetails,
  findGooglePlaceId,
  resolveShortLink,
} from "./places-client";

const DETAILS_ANTWORT = {
  id: "ChIJVillaRufolo",
  displayName: { text: "Villa Rufolo" },
  formattedAddress: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
  addressComponents: [
    { longText: "Ravello", types: ["locality", "political"] },
    { longText: "Salerno", types: ["administrative_area_level_2"] },
  ],
  location: { latitude: 40.6491, longitude: 14.6113 },
  types: ["tourist_attraction", "point_of_interest"],
  websiteUri: "https://villarufolo.com",
  internationalPhoneNumber: "+39 089 857621",
  regularOpeningHours: {
    weekdayDescriptions: ["Montag: 09:00–20:00", "Dienstag: 09:00–20:00"],
  },
  photos: [
    { name: "places/ChIJVillaRufolo/photos/a" },
    { name: "places/ChIJVillaRufolo/photos/b" },
    { name: "places/ChIJVillaRufolo/photos/c" },
    { name: "places/ChIJVillaRufolo/photos/d" },
  ],
};

beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.GOOGLE_PLACES_API_KEY;
});

describe("fetchGooglePlaceDetails (req-026)", () => {
  it("uebernimmt Name, Ort, Adresse, Position, Web, Telefon und Oeffnungszeiten", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => DETAILS_ANTWORT })),
    );

    const place = await fetchGooglePlaceDetails("ChIJVillaRufolo");

    expect(place).toMatchObject({
      placeId: "ChIJVillaRufolo",
      name: "Villa Rufolo",
      ort: "Ravello",
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      position: { lat: 40.6491, lng: 14.6113 },
      web: "https://villarufolo.com",
      phone: "+39 089 857621",
      openingHours: ["Montag: 09:00–20:00", "Dienstag: 09:00–20:00"],
    });
  });

  it("nimmt hoechstens drei Fotos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => DETAILS_ANTWORT })),
    );

    const place = await fetchGooglePlaceDetails("ChIJVillaRufolo");

    expect(place?.photoNames).toEqual([
      "places/ChIJVillaRufolo/photos/a",
      "places/ChIJVillaRufolo/photos/b",
      "places/ChIJVillaRufolo/photos/c",
    ]);
  });

  it("sendet den Zugangsschluessel aus der Umgebungsvariable im Kopf der Anfrage", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => DETAILS_ANTWORT,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchGooglePlaceDetails("ChIJVillaRufolo");

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-key");
  });

  it("fragt ohne hinterlegten Zugangsschluessel gar nicht erst an", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchGooglePlaceDetails("ChIJVillaRufolo")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("liefert null, wenn Google mit einem Fehler antwortet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    expect(await fetchGooglePlaceDetails("ChIJVillaRufolo")).toBeNull();
  });

  it("liefert null, wenn Google nicht erreichbar ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    expect(await fetchGooglePlaceDetails("ChIJVillaRufolo")).toBeNull();
  });
});

describe("findGooglePlaceId (req-026)", () => {
  it("liefert die Kennung des ersten Treffers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ places: [{ id: "ChIJVillaRufolo" }] }),
      })),
    );

    expect(await findGooglePlaceId("Villa Rufolo")).toBe("ChIJVillaRufolo");
  });

  it("schraenkt die Suche auf die Kartenmitte des Links ein", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ places: [{ id: "ChIJVillaRufolo" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await findGooglePlaceId("Villa Rufolo", { lat: 40.6491, lng: 14.6113 });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(init.body)).toMatchObject({
      textQuery: "Villa Rufolo",
      locationBias: {
        circle: { center: { latitude: 40.6491, longitude: 14.6113 } },
      },
    });
  });

  it("liefert null ohne Treffer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ places: [] }) })),
    );

    expect(await findGooglePlaceId("Gibt es nicht")).toBeNull();
  });
});

describe("fetchGooglePhoto (req-026)", () => {
  it("liefert die Bilddaten", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );

    const data = await fetchGooglePhoto("places/x/photos/a");

    expect(Array.from(data ?? [])).toEqual([1, 2, 3]);
  });

  it("liefert null, wenn das Bild nicht zu holen ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );

    expect(await fetchGooglePhoto("places/x/photos/a")).toBeNull();
  });
});

describe("resolveShortLink (req-026)", () => {
  it("liefert die Adresse hinter der Weiterleitung", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        url: "https://www.google.com/maps/place/Villa+Rufolo/@40.6,14.6,17z",
      })),
    );

    expect(await resolveShortLink("https://maps.app.goo.gl/aBcD")).toBe(
      "https://www.google.com/maps/place/Villa+Rufolo/@40.6,14.6,17z",
    );
  });

  it("liefert null, wenn der Kurzlink nicht aufloesbar ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    expect(await resolveShortLink("https://maps.app.goo.gl/aBcD")).toBeNull();
  });
});
