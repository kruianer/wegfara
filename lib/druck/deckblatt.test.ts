import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activities/types";
import type { Poi } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import { anlassUndBeschreibung, druckDeckblatt } from "./deckblatt";
import { druckTage } from "./stationen";

const TRIP: Trip = {
  id: "trip-1",
  title: "30 Johr zämma",
  startDate: "2026-10-25",
  endDate: "2026-10-26",
  mainPlace: { name: "Rothenburg ob der Tauber", lat: 49.3777, lng: 10.1793 },
  description:
    "Ein Wochenende mit unseren Trauzeugen anlässlich des 30-jährigen Hochzeitstages",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

const HOTEL_POI: Poi = {
  id: "poi-hotel",
  tripId: TRIP.id,
  number: 1,
  name: "Romantik Hotel Markusturm",
  ort: "Rothenburg",
  type: "hotel",
  position: { lat: 49.3777, lng: 10.1793 },
  status: "gesetzt",
  buchung: "gebucht",
  kostenCent: 22000,
  photos: [{ id: "foto-hotel-1", position: 1 }],
};

const HOTEL: Activity = {
  id: "activity-hotel",
  tripId: TRIP.id,
  type: "hotel",
  title: "Romantik Hotel Markusturm",
  shortText: "",
  longText: "Zollhaus aus dem 13. Jahrhundert.",
  startAt: "2026-10-25T15:00",
  endAt: "2026-10-25T16:00",
  poiId: HOTEL_POI.id,
};

function deckblatt(
  overrides: { trip?: Trip; activities?: Activity[]; pois?: Poi[] } = {},
) {
  const trip = overrides.trip ?? TRIP;
  const activities = overrides.activities ?? [HOTEL];
  const pois = overrides.pois ?? [HOTEL_POI];
  return druckDeckblatt({
    trip,
    tage: druckTage({ trip, activities, pois }),
    activities,
    pois,
    teilnehmerzahl: 4,
    summen: { gesamtCent: 25200, jePersonCent: 6300 },
    reiseleitung: ["Uwe Kremmel"],
    stand: "2026-10-10",
  });
}

describe("druckDeckblatt -- Seite 1 (req-080)", () => {
  it("nennt Titel und Ort mit Zeitraum", () => {
    const seite = deckblatt();

    expect(seite.titel).toBe("30 Johr zämma");
    expect(seite.ort).toBe("Rothenburg ob der Tauber · 25. – 26. Oktober 2026");
  });

  it("traegt die Beschreibung der Reise", () => {
    expect(deckblatt().beschreibung).toBe(
      "Ein Wochenende mit unseren Trauzeugen anlässlich des 30-jährigen Hochzeitstages",
    );
  });

  it("zeigt vier Zahlen: Dauer, Stationen, Reisende, geplante Kosten", () => {
    const zahlen = deckblatt().zahlen;

    expect(zahlen).toHaveLength(4);
    expect(zahlen[0]).toMatchObject({
      wert: "2",
      einheit: "Tage",
      bezeichnung: "Reisedauer",
    });
    expect(zahlen[1]).toMatchObject({ wert: "1", bezeichnung: "Stationen" });
    expect(zahlen[2]).toMatchObject({ wert: "4", bezeichnung: "Reisende" });
    expect(zahlen[3]).toMatchObject({
      wert: "252",
      einheit: "€",
      bezeichnung: "geplant · 63 € je Person",
      warm: true,
    });
  });

  it("zaehlt als Stationen, was im Heft steht", () => {
    const zweite: Activity = {
      ...HOTEL,
      id: "activity-2",
      title: "Nachtwächter Tour",
      type: "aktivitaet",
      startAt: "2026-10-25T21:30",
      endAt: "2026-10-25T22:30",
      poiId: undefined,
    };

    const zahlen = deckblatt({ activities: [HOTEL, zweite] }).zahlen;

    expect(zahlen[1].wert).toBe("2");
  });

  it("traegt die Eckdaten -- Hauptort, Unterkunft, An- und Abreise, Leitung, Stand", () => {
    const eckdaten = deckblatt().eckdaten;

    expect(eckdaten).toEqual([
      { label: "Hauptort", wert: "Rothenburg ob der Tauber" },
      {
        label: "Unterkunft",
        wert: "Romantik Hotel Markusturm · gebucht",
        warm: true,
      },
      { label: "Anreise", wert: "So, 25. Oktober" },
      { label: "Abreise", wert: "Mo, 26. Oktober" },
      { label: "Reiseleitung", wert: "Uwe Kremmel" },
      { label: "Stand", wert: "10. Oktober 2026" },
    ]);
  });

  it("laesst Zeilen weg, zu denen es nichts zu sagen gibt", () => {
    const seite = druckDeckblatt({
      trip: TRIP,
      tage: [],
      activities: [],
      pois: [],
      teilnehmerzahl: 0,
      summen: { gesamtCent: 0, jePersonCent: null },
      reiseleitung: [],
      stand: "2026-10-10",
    });

    expect(seite.eckdaten.map((zeile) => zeile.label)).toEqual([
      "Hauptort",
      "Anreise",
      "Abreise",
      "Stand",
    ]);
    // Ohne Zuordnung gibt es keinen Betrag je Person -- geteilt wird dann
    // durch nichts.
    expect(seite.zahlen[3].bezeichnung).toBe("geplant");
  });

  it("nimmt als Titelfoto das erste Foto der ersten Station, die eines hat", () => {
    expect(deckblatt().titelFoto).toEqual({
      id: "foto-hotel-1",
      istKiBild: false,
    });
  });

  it("bleibt ohne Foto ohne Titelfoto -- geraten wird keines", () => {
    expect(
      deckblatt({ pois: [{ ...HOTEL_POI, photos: [] }] }).titelFoto,
    ).toBeNull();
  });
});

describe("anlassUndBeschreibung (req-080)", () => {
  it("laesst einen einzelnen Satz im Dashboard", () => {
    expect(anlassUndBeschreibung("Ein Wochenende mit den Trauzeugen")).toEqual({
      vorspann: "",
      beschreibung: "Ein Wochenende mit den Trauzeugen",
    });
  });

  it("stellt den ersten Satz handschriftlich ueber den Titel", () => {
    expect(
      anlassUndBeschreibung(
        "30 Jahre, und wieder zu viert unterwegs. Ein Wochenende mit den Trauzeugen.",
      ),
    ).toEqual({
      vorspann: "30 Jahre, und wieder zu viert unterwegs.",
      beschreibung: "Ein Wochenende mit den Trauzeugen.",
    });
  });

  it("kommt mit einer leeren Beschreibung aus", () => {
    expect(anlassUndBeschreibung("   ")).toEqual({
      vorspann: "",
      beschreibung: "",
    });
  });
});
