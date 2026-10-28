import { describe, expect, it } from "vitest";
import type { Poi } from "@/lib/pois/types";
import type { DruckTag } from "./types";
import { druckTitelFoto, titelfotoKandidaten } from "./titelfoto";

function poi(
  overrides: Partial<Poi> & Pick<Poi, "id" | "number" | "name">,
): Poi {
  return {
    tripId: "trip-1",
    ort: "Bilbao",
    type: "sehenswuerdigkeit",
    position: { lat: 43.26, lng: -2.93 },
    status: "gesetzt",
    photos: [],
    ...overrides,
  } as Poi;
}

const HOTEL = poi({
  id: "poi-hotel",
  number: 12,
  name: "Carlton",
  photos: [{ id: "foto-zimmer", position: 1, source: "google" }],
});
const GUGGENHEIM = poi({
  id: "poi-guggenheim",
  number: 1,
  name: "Guggenheim",
  photos: [
    { id: "foto-guggenheim-2", position: 2, source: "google" },
    { id: "foto-guggenheim-1", position: 1, source: "google" },
  ],
});
const LAGUARDIA = poi({
  id: "poi-laguardia",
  number: 11,
  name: "Laguardia",
  photos: [{ id: "foto-ki", position: 1, source: "ki" }],
});

/** Ein Tag, dessen erste Station das Hotel ist -- mit Zimmerfoto. */
const TAGE: DruckTag[] = [
  {
    nummer: 1,
    datum: "2027-05-18",
    datumText: "Dienstag, 18. Mai 2027",
    ueberschrift: "Bilbao",
    stationen: [
      {
        activityId: "a-hotel",
        poiId: "poi-hotel",
        layout: "l1",
        startzeit: "15:00",
        art: "Hotel",
        name: "Carlton",
        ort: "Bilbao",
        langtext: "",
        grossesFoto: { id: "foto-zimmer", istKiBild: false },
        kleineFotos: [],
        alternative: null,
        position: { lat: 43.26, lng: -2.93 },
      },
    ],
  },
];

describe("titelfotoKandidaten (req-103)", () => {
  it("nennt alle Fotos der Reise mit ihrer Herkunft, nach POI-Nummer", () => {
    expect(titelfotoKandidaten([HOTEL, LAGUARDIA, GUGGENHEIM])).toEqual([
      {
        photoId: "foto-guggenheim-1",
        herkunft: "1 · Guggenheim",
        istKiBild: false,
      },
      {
        photoId: "foto-guggenheim-2",
        herkunft: "1 · Guggenheim",
        istKiBild: false,
      },
      { photoId: "foto-ki", herkunft: "11 · Laguardia", istKiBild: true },
      { photoId: "foto-zimmer", herkunft: "12 · Carlton", istKiBild: false },
    ]);
  });
});

describe("druckTitelFoto (req-103)", () => {
  const pois = [HOTEL, GUGGENHEIM, LAGUARDIA];

  it("nimmt das gewaehlte Foto des Guggenheim", () => {
    expect(
      druckTitelFoto({
        titelfoto: {
          tripId: "trip-1",
          art: "poi",
          photoId: "foto-guggenheim-1",
        },
        pois,
        tage: TAGE,
      }),
    ).toEqual({ url: "/api/poi-fotos/foto-guggenheim-1", istKiBild: false });
  });

  it("nimmt ohne Wahl das erste Foto der ersten Station -- wie bisher", () => {
    expect(druckTitelFoto({ titelfoto: null, pois, tage: TAGE })).toEqual({
      url: "/api/poi-fotos/foto-zimmer",
      istKiBild: false,
    });
  });

  it("nimmt ein eigenes Bild ueber seine eigene Adresse", () => {
    expect(
      druckTitelFoto({
        titelfoto: {
          tripId: "trip-1",
          art: "eigen",
          istKiBild: true,
          stand: "2026-10-28T10:00:00.000Z",
        },
        pois,
        tage: TAGE,
      }),
    ).toEqual({
      url: "/api/reise-titelfoto/trip-1?stand=2026-10-28T10%3A00%3A00.000Z",
      istKiBild: true,
    });
  });

  it("faellt auf die Vorgabe zurueck, wenn das gewaehlte Foto fehlt", () => {
    expect(
      druckTitelFoto({
        titelfoto: { tripId: "trip-1", art: "poi", photoId: "weg" },
        pois,
        tage: TAGE,
      }),
    ).toEqual({ url: "/api/poi-fotos/foto-zimmer", istKiBild: false });
  });

  it("traegt das Zeichen eines gewaehlten KI-Bildes weiter", () => {
    expect(
      druckTitelFoto({
        titelfoto: { tripId: "trip-1", art: "poi", photoId: "foto-ki" },
        pois,
        tage: TAGE,
      })?.istKiBild,
    ).toBe(true);
  });
});
