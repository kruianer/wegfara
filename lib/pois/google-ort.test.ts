import { afterEach, describe, expect, it, vi } from "vitest";
import type { GooglePlace } from "@/lib/google/types";
import { GOOGLE_LINK_FAILURES } from "./google-link-lookup";
import {
  GOOGLE_LINK_FAILURE_TEXT,
  googleOrtAusPlace,
  googleQuelleVonOrt,
  ortAusGoogleLink,
} from "./google-ort";

function villaRufolo(overrides: Partial<GooglePlace> = {}): GooglePlace {
  return {
    placeId: "ChIJVillaRufolo",
    name: "Villa Rufolo",
    address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    position: { lat: 40.6491, lng: 14.6113 },
    types: ["tourist_attraction", "point_of_interest"],
    web: "https://villarufolo.com",
    description: "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
    phone: "+39 089 857621",
    openingHours: ["Montag: 09:00–20:00", "Dienstag: 09:00–20:00"],
    rating: 4.6,
    ratingCount: 1240,
    photoNames: ["places/x/photos/a", "places/x/photos/b"],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("googleOrtAusPlace (req-048)", () => {
  it("übersetzt die Angaben von Google in Formularwerte", () => {
    expect(googleOrtAusPlace(villaRufolo())).toEqual({
      placeId: "ChIJVillaRufolo",
      name: "Villa Rufolo",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      web: "https://villarufolo.com",
      phone: "+39 089 857621",
      openingHours: "Montag: 09:00–20:00\nDienstag: 09:00–20:00",
      shortText: "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
      longText: "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      photoNames: ["places/x/photos/a", "places/x/photos/b"],
    });
  });

  it("bildet die Art des Ortes auf einen POI-Typ ab", () => {
    expect(googleOrtAusPlace(villaRufolo({ types: ["restaurant"] })).type).toBe(
      "restaurant",
    );
  });

  it("lässt leer, was Google nicht kennt", () => {
    const ort = googleOrtAusPlace(
      villaRufolo({
        address: undefined,
        web: undefined,
        phone: undefined,
        openingHours: undefined,
        description: undefined,
        rating: undefined,
        ratingCount: undefined,
      }),
    );

    expect(ort).toMatchObject({
      address: "",
      web: "",
      phone: "",
      openingHours: "",
      shortText: "",
      longText: "",
      bewertung: null,
      bewertungAnzahl: null,
    });
  });
});

describe("googleQuelleVonOrt (req-048)", () => {
  it("nennt Kennung, Bewertung und Fotos für das Speichern", () => {
    expect(googleQuelleVonOrt(googleOrtAusPlace(villaRufolo()))).toEqual({
      placeId: "ChIJVillaRufolo",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      photoNames: ["places/x/photos/a", "places/x/photos/b"],
    });
  });
});

describe("ortAusGoogleLink (req-048)", () => {
  const LINK = "https://maps.app.goo.gl/aBcD1234";

  it("schickt den Link an die Schnittstelle und liefert den Ort", async () => {
    const ort = googleOrtAusPlace(villaRufolo());
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: "gefunden", ort }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "gefunden",
      ort,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("/api/ort-aus-link");
    expect(JSON.parse(init.body)).toEqual({ link: LINK });
  });

  it("reicht den Grund eines Fehlschlags durch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: "fehler", reason: "kein_google_link" }),
      })),
    );

    expect(await ortAusGoogleLink("Villa Rufolo")).toEqual({
      result: "fehler",
      reason: "kein_google_link",
    });
  });

  it("meldet eine gescheiterte Übertragung als fehlgeschlagene Abfrage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "fehler",
      reason: "abfrage_fehlgeschlagen",
    });
  });

  it("nennt den fehlenden Zugangsschlüssel als eigenen Grund", async () => {
    // So antwortet die Schnittstelle ohne hinterlegten Zugangsschlüssel
    // (req-028) -- die Oberfläche fragt dann zwar gar nicht erst an, aber
    // still bleiben darf sie auch hier nie (bug-021, bug-026).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 409, json: async () => ({}) })),
    );

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "fehler",
      reason: "kein_zugangsschluessel",
    });
  });

  it("meldet eine sonstige abgewiesene Anfrage als fehlgeschlagene Abfrage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "fehler",
      reason: "abfrage_fehlgeschlagen",
    });
  });

  /**
   * Eine Antwort, die nicht wie erwartet aussieht, darf nicht als Erfolg
   * durchgehen (bug-026): das Formular liest daraus sonst einen Ort, der
   * nicht da ist -- und bleibt genau deshalb still.
   */
  it("meldet eine unerwartete Antwort als fehlgeschlagene Abfrage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "fehler",
      reason: "abfrage_fehlgeschlagen",
    });
  });

  it("meldet einen Ort ohne Name oder Position als fehlgeschlagene Abfrage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: "gefunden", ort: { name: "Villa" } }),
      })),
    );

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "fehler",
      reason: "abfrage_fehlgeschlagen",
    });
  });

  it("meldet einen unbekannten Grund als fehlgeschlagene Abfrage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: "fehler", reason: "was-auch-immer" }),
      })),
    );

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "fehler",
      reason: "abfrage_fehlgeschlagen",
    });
  });

  it("reicht einen abgewiesenen Zugang durch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: "fehler", reason: "zugang_abgelehnt" }),
      })),
    );

    expect(await ortAusGoogleLink(LINK)).toEqual({
      result: "fehler",
      reason: "zugang_abgelehnt",
    });
  });
});

describe("GOOGLE_LINK_FAILURE_TEXT (bug-026)", () => {
  it("nennt zu jedem Grund einen Text", () => {
    for (const reason of GOOGLE_LINK_FAILURES) {
      expect(GOOGLE_LINK_FAILURE_TEXT[reason].length).toBeGreaterThan(0);
    }
  });

  /**
   * Ein abgewiesener Schlüssel ist etwas anderes als ein Ort, den es nicht
   * gibt: die Meldung muss auf den Schlüssel zeigen, nicht auf den Link.
   */
  it("zeigt beim abgewiesenen Zugang auf den Zugangsschlüssel", () => {
    expect(GOOGLE_LINK_FAILURE_TEXT.zugang_abgelehnt).toContain(
      "Zugangsschlüssel",
    );
    expect(GOOGLE_LINK_FAILURE_TEXT.zugang_abgelehnt).not.toBe(
      GOOGLE_LINK_FAILURE_TEXT.ort_nicht_gefunden,
    );
  });
});
