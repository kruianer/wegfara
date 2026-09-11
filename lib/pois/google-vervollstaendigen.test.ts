import { describe, expect, it, vi } from "vitest";
import type { GooglePlace } from "@/lib/google/types";
import {
  ortZuPoi,
  suchbegriffZuPoi,
  type PoiGoogleDeps,
} from "./google-vervollstaendigen";
import type { Poi } from "./types";

const VILLA_RUFOLO: GooglePlace = {
  placeId: "ChIJVillaRufolo",
  name: "Villa Rufolo",
  address: "Piazza Duomo, 84010 Ravello SA, Italien",
  position: { lat: 40.6491, lng: 14.6113 },
  types: ["tourist_attraction"],
  photoNames: ["places/x/photos/1"],
};

function gefunden(place: GooglePlace | null = VILLA_RUFOLO) {
  return { ok: true, treffer: place } as const;
}

function deps(overrides: Partial<PoiGoogleDeps> = {}): PoiGoogleDeps {
  return {
    findPlace: vi.fn(async () => gefunden()),
    placeDetails: vi.fn(async () => gefunden()),
    ...overrides,
  };
}

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: "trip-1",
    number: 4,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6491, lng: 14.6113 },
    status: "weiss_nicht",
    ...overrides,
  };
}

describe("ortZuPoi (req-061)", () => {
  it("schlaegt ueber die gespeicherte Kennung nach", async () => {
    const placeDetails = vi.fn(async () => gefunden());
    const findPlace = vi.fn(async () => gefunden());

    const treffer = await ortZuPoi(
      poi({ googlePlaceId: "ChIJVillaRufolo" }),
      deps({ placeDetails, findPlace }),
    );

    expect(placeDetails).toHaveBeenCalledWith("ChIJVillaRufolo");
    // Die Suche nach dem Namen kostete ein zweites Mal Geld.
    expect(findPlace).not.toHaveBeenCalled();
    expect(treffer).toEqual({ ok: true, place: VILLA_RUFOLO });
  });

  it("sucht ohne Kennung ueber Name und Position", async () => {
    const findPlace = vi.fn(async () => gefunden());

    const treffer = await ortZuPoi(poi(), deps({ findPlace }));

    expect(findPlace).toHaveBeenCalledWith("Villa Rufolo Ravello", {
      lat: 40.6491,
      lng: 14.6113,
    });
    expect(treffer).toEqual({ ok: true, place: VILLA_RUFOLO });
  });

  it("nimmt die Anschrift, wenn es eine gibt", async () => {
    const findPlace = vi.fn(async () => gefunden());

    await ortZuPoi(
      poi({ address: "Piazza Duomo 1, Ravello" }),
      deps({ findPlace }),
    );

    expect(findPlace).toHaveBeenCalledWith(
      "Villa Rufolo Piazza Duomo 1, Ravello",
      { lat: 40.6491, lng: 14.6113 },
    );
  });

  it("meldet einen Ort, den Google nicht kennt", async () => {
    const treffer = await ortZuPoi(
      poi(),
      deps({ findPlace: vi.fn(async () => gefunden(null)) }),
    );

    expect(treffer).toEqual({ ok: false, reason: "ort_nicht_gefunden" });
  });

  it("reicht einen abgewiesenen Zugangsschluessel weiter", async () => {
    const treffer = await ortZuPoi(
      poi({ googlePlaceId: "ChIJVillaRufolo" }),
      deps({
        placeDetails: vi.fn(async () => ({
          ok: false as const,
          fehler: "zugang_abgelehnt" as const,
        })),
      }),
    );

    expect(treffer).toEqual({ ok: false, reason: "zugang_abgelehnt" });
  });

  it("fragt ohne Namen gar nicht erst an", async () => {
    const findPlace = vi.fn(async () => gefunden());

    const treffer = await ortZuPoi(
      poi({ name: "  ", ort: "", address: undefined }),
      deps({ findPlace }),
    );

    expect(findPlace).not.toHaveBeenCalled();
    expect(treffer).toEqual({ ok: false, reason: "ort_nicht_gefunden" });
  });
});

describe("suchbegriffZuPoi (req-061)", () => {
  it("nennt Name und Ort", () => {
    expect(suchbegriffZuPoi({ name: "Villa Rufolo", ort: "Ravello" })).toBe(
      "Villa Rufolo Ravello",
    );
  });

  it("laesst ohne Ort den Namen allein stehen", () => {
    expect(suchbegriffZuPoi({ name: "Villa Rufolo", ort: "" })).toBe(
      "Villa Rufolo",
    );
  });
});
