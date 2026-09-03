import { describe, expect, it, vi } from "vitest";
import type { GooglePlace } from "@/lib/google/types";
import {
  lookupPlaceFromGoogleLink,
  type GoogleLinkDeps,
} from "./google-link-lookup";

const VILLA_RUFOLO: GooglePlace = {
  placeId: "ChIJVillaRufolo",
  name: "Villa Rufolo",
  ort: "Ravello",
  address: "Piazza Duomo, 84010 Ravello SA, Italien",
  position: { lat: 40.6491, lng: 14.6113 },
  types: ["tourist_attraction", "point_of_interest"],
  web: "https://villarufolo.com",
  phone: "+39 089 857621",
  openingHours: ["Montag: 09:00–20:00"],
  photoNames: ["places/x/photos/1"],
};

function deps(overrides: Partial<GoogleLinkDeps> = {}): GoogleLinkDeps {
  return {
    resolveShortLink: vi.fn(async () => null),
    findPlaceId: vi.fn(async () => "ChIJVillaRufolo"),
    placeDetails: vi.fn(async () => VILLA_RUFOLO),
    ...overrides,
  };
}

describe("lookupPlaceFromGoogleLink (req-026)", () => {
  it("liefert den Ort zu einem Link mit Ortskennung", async () => {
    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.com/maps/search/?api=1&query=Villa+Rufolo&query_place_id=ChIJVillaRufolo",
      deps(),
    );

    expect(lookup).toEqual({ ok: true, place: VILLA_RUFOLO });
  });

  it("schlaegt einen Link ohne Kennung ueber den Namen nach", async () => {
    const findPlaceId = vi.fn(async () => "ChIJVillaRufolo");

    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.de/maps/place/Villa+Rufolo/@40.6491,14.6113,17z",
      deps({ findPlaceId }),
    );

    expect(findPlaceId).toHaveBeenCalledWith("Villa Rufolo", {
      lat: 40.6491,
      lng: 14.6113,
    });
    expect(lookup.ok).toBe(true);
  });

  it("loest einen Kurzlink auf und schlaegt dahinter nach", async () => {
    const resolveShortLink = vi.fn(
      async () =>
        "https://www.google.com/maps/place/Villa+Rufolo/@40.6491,14.6113,17z/data=!1sChIJVillaRufolo",
    );
    const placeDetails = vi.fn(async () => VILLA_RUFOLO);

    const lookup = await lookupPlaceFromGoogleLink(
      "https://maps.app.goo.gl/aBcD1234",
      deps({ resolveShortLink, placeDetails }),
    );

    expect(resolveShortLink).toHaveBeenCalledWith(
      "https://maps.app.goo.gl/aBcD1234",
    );
    expect(placeDetails).toHaveBeenCalledWith("ChIJVillaRufolo");
    expect(lookup.ok).toBe(true);
  });

  it("nennt als Grund, dass es kein Google-Maps-Link ist", async () => {
    const lookup = await lookupPlaceFromGoogleLink("Villa Rufolo", deps());

    expect(lookup).toEqual({ ok: false, reason: "kein_google_link" });
  });

  it("nennt als Grund, dass der Ort nicht gefunden wurde", async () => {
    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.de/maps/place/Gibts+Nicht/@40.6,14.6,17z",
      deps({ findPlaceId: vi.fn(async () => null) }),
    );

    expect(lookup).toEqual({ ok: false, reason: "ort_nicht_gefunden" });
  });

  it("nennt als Grund, dass die Abfrage fehlgeschlagen ist", async () => {
    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.com/maps/search/?api=1&query_place_id=ChIJVillaRufolo",
      deps({ placeDetails: vi.fn(async () => null) }),
    );

    expect(lookup).toEqual({ ok: false, reason: "abfrage_fehlgeschlagen" });
  });

  it("folgt keiner Kette von Kurzlinks", async () => {
    const resolveShortLink = vi.fn(
      async () => "https://maps.app.goo.gl/weiterUndWeiter",
    );

    const lookup = await lookupPlaceFromGoogleLink(
      "https://maps.app.goo.gl/aBcD1234",
      deps({ resolveShortLink }),
    );

    expect(resolveShortLink).toHaveBeenCalledTimes(1);
    expect(lookup).toEqual({ ok: false, reason: "ort_nicht_gefunden" });
  });

  it("fragt bei einem Link ohne Ortsnamen gar nicht erst nach", async () => {
    const findPlaceId = vi.fn(async () => "ChIJIrgendwas");

    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.com/maps/place/40.6491,14.6113",
      deps({ findPlaceId }),
    );

    expect(findPlaceId).not.toHaveBeenCalled();
    expect(lookup).toEqual({ ok: false, reason: "ort_nicht_gefunden" });
  });
});
