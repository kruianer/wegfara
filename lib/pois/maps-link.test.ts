import { describe, expect, it } from "vitest";
import { poiMapsUrl } from "./maps-link";
import type { Poi } from "./types";

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: "trip-1",
    number: 1,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.649, lng: 14.611 },
    status: "weiss_nicht",
    ...overrides,
  };
}

/**
 * Der Maps-Knopf der POI-Liste (bug-037): Stammt der Ort aus Google, oeffnet
 * er den Ort selbst — mit Namen, Bewertungen und Fotos — statt einer Suche
 * nach seinen Koordinaten.
 */
describe("poiMapsUrl (bug-037)", () => {
  it("oeffnet mit Google-Kennung den Ort selbst", () => {
    const url = new URL(poiMapsUrl(poi({ googlePlaceId: "ChIJVillaRufolo" })));

    expect(url.searchParams.get("query_place_id")).toBe("ChIJVillaRufolo");
  });

  it("nennt neben der Kennung die Koordinaten als Rueckfall", () => {
    const url = new URL(poiMapsUrl(poi({ googlePlaceId: "ChIJVillaRufolo" })));

    // Google verlangt zur Kennung immer ein `query`; es greift nur, wenn
    // Google die Kennung nicht mehr kennt.
    expect(url.searchParams.get("query")).toBe("40.649,14.611");
  });

  it("oeffnet ohne Google-Kennung die Koordinaten", () => {
    const url = new URL(poiMapsUrl(poi()));

    expect(url.searchParams.get("query")).toBe("40.649,14.611");
    expect(url.searchParams.has("query_place_id")).toBe(false);
  });

  it("behandelt eine leere Kennung wie keine", () => {
    const url = new URL(poiMapsUrl(poi({ googlePlaceId: "  " })));

    expect(url.searchParams.has("query_place_id")).toBe(false);
  });

  it("bleibt ein Google-Maps-Suchlink", () => {
    const url = new URL(poiMapsUrl(poi({ googlePlaceId: "ChIJVillaRufolo" })));

    expect(url.origin + url.pathname).toBe(
      "https://www.google.com/maps/search/",
    );
    expect(url.searchParams.get("api")).toBe("1");
  });

  it("gibt ausser Ortsangaben nichts an Google weiter", () => {
    const url = new URL(poiMapsUrl(poi({ googlePlaceId: "ChIJVillaRufolo" })));

    // Keine Nutzerdaten an Google (siehe vision.md) — auch nicht die
    // Kennungen aus wegfaras eigener Ablage.
    expect([...url.searchParams.keys()].sort()).toEqual([
      "api",
      "query",
      "query_place_id",
    ]);
  });
});
