import { describe, expect, it, vi } from "vitest";
import type { GooglePlace } from "@/lib/google/types";
import {
  lookupPlaceFromGoogleLink,
  type GoogleLinkDeps,
} from "./google-link-lookup";

const VILLA_RUFOLO: GooglePlace = {
  placeId: "ChIJVillaRufolo",
  name: "Villa Rufolo",
  address: "Piazza Duomo, 84010 Ravello SA, Italien",
  position: { lat: 40.6491, lng: 14.6113 },
  types: ["tourist_attraction", "point_of_interest"],
  web: "https://villarufolo.com",
  phone: "+39 089 857621",
  openingHours: ["Montag: 09:00–20:00"],
  photoNames: ["places/x/photos/1"],
};

/** Eine geglueckte Abfrage mit diesem Treffer -- oder ohne. */
function gefunden(place: GooglePlace | null = VILLA_RUFOLO) {
  return { ok: true, treffer: place } as const;
}

function deps(overrides: Partial<GoogleLinkDeps> = {}): GoogleLinkDeps {
  return {
    resolveShortLink: vi.fn(async () => null),
    findPlace: vi.fn(async () => gefunden()),
    placeDetails: vi.fn(async () => gefunden()),
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
    const findPlace = vi.fn(async () => gefunden());

    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.de/maps/place/Villa+Rufolo/@40.6491,14.6113,17z",
      deps({ findPlace }),
    );

    expect(findPlace).toHaveBeenCalledWith("Villa Rufolo", {
      lat: 40.6491,
      lng: 14.6113,
    });
    expect(lookup).toEqual({ ok: true, place: VILLA_RUFOLO });
  });

  /**
   * Die Namenssuche liefert die Angaben gleich mit (bug-026) -- ein zweiter
   * Aufruf fuer die Einzelheiten kostete den Account noch einmal Geld.
   */
  it("fragt bei der Namenssuche kein zweites Mal nach den Angaben", async () => {
    const placeDetails = vi.fn(async () => gefunden());

    await lookupPlaceFromGoogleLink(
      "https://www.google.de/maps/place/Villa+Rufolo/@40.6491,14.6113,17z",
      deps({ placeDetails }),
    );

    expect(placeDetails).not.toHaveBeenCalled();
  });

  it("loest einen Kurzlink auf und schlaegt dahinter nach", async () => {
    const resolveShortLink = vi.fn(
      async () =>
        "https://www.google.com/maps/place/Villa+Rufolo/@40.6491,14.6113,17z/data=!1sChIJVillaRufolo",
    );
    const placeDetails = vi.fn(async () => gefunden());

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
      deps({ findPlace: vi.fn(async () => gefunden(null)) }),
    );

    expect(lookup).toEqual({ ok: false, reason: "ort_nicht_gefunden" });
  });

  it("nennt als Grund, dass die Abfrage fehlgeschlagen ist", async () => {
    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.com/maps/search/?api=1&query_place_id=ChIJVillaRufolo",
      deps({
        placeDetails: vi.fn(async () => ({
          ok: false as const,
          fehler: "abfrage_fehlgeschlagen" as const,
        })),
      }),
    );

    expect(lookup).toEqual({ ok: false, reason: "abfrage_fehlgeschlagen" });
  });

  /**
   * Ein abgewiesener Zugangsschluessel ist etwas anderes als ein Ort, den es
   * nicht gibt (bug-026): daran ist kein Link schuld, und der Nutzer muss es
   * an seinem Schluessel erkennen koennen.
   */
  it("nennt einen abgewiesenen Zugang als eigenen Grund", async () => {
    const abgelehnt = vi.fn(async () => ({
      ok: false as const,
      fehler: "zugang_abgelehnt" as const,
    }));

    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.de/maps/place/Villa+Rufolo/@40.6491,14.6113,17z",
      deps({ findPlace: abgelehnt }),
    );

    expect(lookup).toEqual({ ok: false, reason: "zugang_abgelehnt" });
  });

  it("nennt den abgewiesenen Zugang auch hinter einem Kurzlink", async () => {
    const resolveShortLink = vi.fn(
      async () =>
        "https://www.google.com/maps/place/inatura/@47.409286,9.737,17z/data=!3m5!1s0x479b6b4a8e60626b:0x53b81cddba9fa03a",
    );

    const lookup = await lookupPlaceFromGoogleLink(
      "https://maps.app.goo.gl/AtmT9iWJpmweLMYk8",
      deps({
        resolveShortLink,
        findPlace: vi.fn(async () => ({
          ok: false as const,
          fehler: "zugang_abgelehnt" as const,
        })),
      }),
    );

    expect(lookup).toEqual({ ok: false, reason: "zugang_abgelehnt" });
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
    const findPlace = vi.fn(async () => gefunden());

    const lookup = await lookupPlaceFromGoogleLink(
      "https://www.google.com/maps/place/40.6491,14.6113",
      deps({ findPlace }),
    );

    expect(findPlace).not.toHaveBeenCalled();
    expect(lookup).toEqual({ ok: false, reason: "ort_nicht_gefunden" });
  });
});
