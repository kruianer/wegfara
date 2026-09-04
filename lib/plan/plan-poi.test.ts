import { describe, expect, it } from "vitest";
import type { Poi, PoiType } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import { HOUR_HEIGHT_PX } from "./timeline-grid";
import {
  activityTypeForPoi,
  dayTimeAt,
  dropStartAt,
  plannedActivityFromPoi,
  snapStartMinutes,
} from "./plan-poi";

const TRIP: Trip = {
  id: "trip-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: TRIP.id,
    number: 2,
    name: "Ausgrabungsstätte Pompeji",
    ort: "Pompei",
    type: "sehenswuerdigkeit",
    position: { lat: 40.7489, lng: 14.4989 },
    status: "gesetzt",
    ...overrides,
  };
}

/** Das Raster beginnt um 08:00, wenn der Tag keine frueheren Punkte hat (req-011). */
const GRID = { startHour: 8, endHour: 22 };

describe("activityTypeForPoi (req-039)", () => {
  it('macht aus "Strand" eine Sehenswuerdigkeit', () => {
    expect(activityTypeForPoi("strand")).toBe("sehenswuerdigkeit");
  });

  it("laesst die uebrigen Typen unveraendert", () => {
    const uebrige: PoiType[] = [
      "sehenswuerdigkeit",
      "stadt_dorf",
      "restaurant",
      "aktivitaet",
      "hotel",
      "weltkulturerbe",
    ];
    for (const type of uebrige) {
      expect(activityTypeForPoi(type)).toBe(type);
    }
  });
});

describe("snapStartMinutes (req-039)", () => {
  it("rastet auf die zuletzt erreichte Viertelstunde ein", () => {
    expect(snapStartMinutes(10 * 60)).toBe(600);
    expect(snapStartMinutes(10 * 60 + 7)).toBe(600);
    expect(snapStartMinutes(10 * 60 + 14)).toBe(600);
    expect(snapStartMinutes(10 * 60 + 15)).toBe(615);
  });

  it("bleibt innerhalb des Reisetages", () => {
    expect(snapStartMinutes(-30)).toBe(0);
    expect(snapStartMinutes(25 * 60)).toBe(24 * 60 - 15);
  });
});

describe("dropStartAt (req-039)", () => {
  it("beginnt dort, wo der POI losgelassen wurde", () => {
    // Zwei Stunden unter dem Rasterbeginn 08:00.
    const offset = 2 * HOUR_HEIGHT_PX;

    expect(dropStartAt("2026-07-20", offset, GRID)).toBe("2026-07-20T10:00");
  });

  it("rastet ein Loslassen zwischen 10:00 und 10:15 auf 10:00", () => {
    const zehnUhr = 2 * HOUR_HEIGHT_PX;
    const knappVorViertel = zehnUhr + (14 / 60) * HOUR_HEIGHT_PX;

    expect(dropStartAt("2026-07-20", knappVorViertel, GRID)).toBe(
      "2026-07-20T10:00",
    );
  });
});

describe("dayTimeAt", () => {
  it("legt ein Ende nach Mitternacht auf den Folgetag", () => {
    expect(dayTimeAt("2026-07-20", 23 * 60 + 45 + 150)).toBe(
      "2026-07-21T02:15",
    );
  });
});

describe("plannedActivityFromPoi (req-039)", () => {
  it("uebernimmt Name, Position und Typ des POI, Texte bleiben leer", () => {
    const values = plannedActivityFromPoi(poi(), TRIP, "2026-07-20T10:00");

    expect(values).toEqual({
      tripId: TRIP.id,
      poiId: "poi-1",
      type: "sehenswuerdigkeit",
      title: "Ausgrabungsstätte Pompeji",
      shortText: "",
      longText: "",
      startAt: "2026-07-20T10:00",
      endAt: "2026-07-20T12:30",
      position: { lat: 40.7489, lng: 14.4989 },
    });
  });

  it("nimmt die geschaetzte Dauer des POI-Typs als Dauer", () => {
    // Stadt & Dorf: 3 h (req-011, GUI).
    const values = plannedActivityFromPoi(
      poi({ type: "stadt_dorf" }),
      TRIP,
      "2026-07-20T10:00",
    );

    expect(values?.endAt).toBe("2026-07-20T13:00");
  });

  it('macht aus einem POI vom Typ "Strand" einen Programmpunkt "Sehenswuerdigkeit"', () => {
    const values = plannedActivityFromPoi(
      poi({ type: "strand" }),
      TRIP,
      "2026-07-20T10:00",
    );

    expect(values?.type).toBe("sehenswuerdigkeit");
    // Die Dauer bleibt die des POI-Typs Strand (3 h).
    expect(values?.endAt).toBe("2026-07-20T13:00");
  });

  it("rastet auch eine uebergebene Zeit auf 15 Minuten ein", () => {
    const values = plannedActivityFromPoi(poi(), TRIP, "2026-07-20T10:07");

    expect(values?.startAt).toBe("2026-07-20T10:00");
  });

  it("verplant einen POI mit Status Wahrscheinlich", () => {
    expect(
      plannedActivityFromPoi(
        poi({ status: "wahrscheinlich" }),
        TRIP,
        "2026-07-20T10:00",
      ),
    ).not.toBeNull();
  });

  it('verplant keinen POI mit Status "Weiß noch nicht" oder "Verworfen"', () => {
    for (const status of [
      "weiss_nicht",
      "auf_keinen_fall",
      "wenn_zeit",
    ] as const) {
      expect(
        plannedActivityFromPoi(poi({ status }), TRIP, "2026-07-20T10:00"),
      ).toBeNull();
    }
  });

  it("laesst ausserhalb des Reisezeitraums keinen Programmpunkt entstehen", () => {
    expect(plannedActivityFromPoi(poi(), TRIP, "2026-07-17T10:00")).toBeNull();
    expect(plannedActivityFromPoi(poi(), TRIP, "2026-07-24T10:00")).toBeNull();
    expect(
      plannedActivityFromPoi(poi(), TRIP, "2026-07-23T10:00"),
    ).not.toBeNull();
  });

  it("verplant keinen POI einer anderen Reise", () => {
    expect(
      plannedActivityFromPoi(
        poi({ tripId: "trip-2" }),
        TRIP,
        "2026-07-20T10:00",
      ),
    ).toBeNull();
  });

  it("weist eine unbrauchbare Zeitangabe ab", () => {
    expect(plannedActivityFromPoi(poi(), TRIP, "2026-07-20")).toBeNull();
    expect(plannedActivityFromPoi(poi(), TRIP, "morgen früh")).toBeNull();
  });
});
