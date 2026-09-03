// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { googlePlacesClient } from "./places-client";

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

/** Der Zugang haengt am Zugangsschluessel des Accounts (req-028). */
const google = googlePlacesClient("test-key");

describe("placeDetails (req-026)", () => {
  it("uebernimmt Name, Ort, Adresse, Position, Web, Telefon und Oeffnungszeiten", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => DETAILS_ANTWORT })),
    );

    const place = await google.placeDetails("ChIJVillaRufolo");

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

    const place = await google.placeDetails("ChIJVillaRufolo");

    expect(place?.photoNames).toEqual([
      "places/ChIJVillaRufolo/photos/a",
      "places/ChIJVillaRufolo/photos/b",
      "places/ChIJVillaRufolo/photos/c",
    ]);
  });

  /**
   * Der Schluessel kommt vom Account und nicht aus der Umgebung (req-028):
   * abgerechnet wird bei dem, der ihn hinterlegt hat.
   */
  it("sendet den Zugangsschluessel des Accounts im Kopf der Anfrage", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "schluessel-der-umgebung");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => DETAILS_ANTWORT,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await googlePlacesClient("schluessel-des-accounts").placeDetails(
      "ChIJVillaRufolo",
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers["X-Goog-Api-Key"]).toBe("schluessel-des-accounts");
    vi.unstubAllEnvs();
  });

  it("liefert null, wenn Google mit einem Fehler antwortet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    expect(await google.placeDetails("ChIJVillaRufolo")).toBeNull();
  });

  it("liefert null, wenn Google nicht erreichbar ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    expect(await google.placeDetails("ChIJVillaRufolo")).toBeNull();
  });
});

describe("findPlaceId (req-026)", () => {
  it("liefert die Kennung des ersten Treffers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ places: [{ id: "ChIJVillaRufolo" }] }),
      })),
    );

    expect(await google.findPlaceId("Villa Rufolo")).toBe("ChIJVillaRufolo");
  });

  it("schraenkt die Suche auf die Kartenmitte des Links ein", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ places: [{ id: "ChIJVillaRufolo" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await google.findPlaceId("Villa Rufolo", { lat: 40.6491, lng: 14.6113 });

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

    expect(await google.findPlaceId("Gibt es nicht")).toBeNull();
  });
});

describe("fetchPhoto (req-026)", () => {
  it("liefert die Bilddaten", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );

    const data = await google.fetchPhoto("places/x/photos/a");

    expect(Array.from(data ?? [])).toEqual([1, 2, 3]);
  });

  it("liefert null, wenn das Bild nicht zu holen ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );

    expect(await google.fetchPhoto("places/x/photos/a")).toBeNull();
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

    expect(await google.resolveShortLink("https://maps.app.goo.gl/aBcD")).toBe(
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

    expect(
      await google.resolveShortLink("https://maps.app.goo.gl/aBcD"),
    ).toBeNull();
  });
});
