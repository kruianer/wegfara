import { describe, expect, it, vi } from "vitest";
import type { Activity } from "@/lib/activities/types";
import type { Poi, PoiPosition, PoiStatus, PoiType } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import type { Reisetempo } from "@/lib/trips/tempo";
import {
  buildGruppenPrompt,
  engeStellen,
  erstellePlanvorschlag,
  parseTagesgruppen,
  vorschlagAlsActivities,
  type PlanungsDeps,
} from "./ki-planung";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

/**
 * "KI planen lassen" (req-056). Die KI und der Routing-Dienst antworten hier
 * aus dem Haus -- kein Test haengt im Netz oder verursacht Kosten (siehe
 * delivery/stack.md).
 */

const TAGE = ["2026-07-18", "2026-07-19", "2026-07-20"];

function trip(tempo: Reisetempo = "ausgewogen"): Trip {
  return {
    id: "trip-1",
    title: "Süditalien Rundreise",
    startDate: TAGE[0],
    endDate: TAGE[2],
    mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
    description: "",
    state: "in_planung",
    tempo,
    praeferenzen: LEERE_PRAEFERENZEN,
  };
}

function nahBei(index: number): PoiPosition {
  return { lat: 40.634 + index * 0.01, lng: 14.6027 };
}

function poi(
  nummer: number,
  {
    type = "sehenswuerdigkeit",
    status = "gesetzt",
    position = nahBei(nummer),
  }: { type?: PoiType; status?: PoiStatus; position?: PoiPosition } = {},
): Poi {
  return {
    id: `poi-${nummer}`,
    tripId: "trip-1",
    number: nummer,
    name: `Ort ${nummer}`,
    ort: "Amalfi",
    type,
    position,
    status,
  };
}

/** Die KI antwortet mit dieser Verteilung, der Routing-Dienst schweigt. */
function deps(
  antwort: string | null,
  fahrzeit: (von: PoiPosition, nach: PoiPosition) => number | null = () => null,
): PlanungsDeps & { gruppiere: ReturnType<typeof vi.fn> } {
  return {
    gruppiere: vi.fn(async () => antwort),
    fahrzeitMinuten: vi.fn(async (von, nach) => fahrzeit(von, nach)),
  };
}

function tagVon(startAt: string): string {
  return startAt.slice(0, 10);
}

describe("parseTagesgruppen (req-056)", () => {
  const POIS = [poi(1), poi(2), poi(3)];

  it("liest die Nummern je Reisetag", () => {
    const hinweis = parseTagesgruppen('{"tage": [[1, 3], [2]]}', POIS, 3);

    expect(hinweis?.get("poi-1")).toBe(0);
    expect(hinweis?.get("poi-3")).toBe(0);
    expect(hinweis?.get("poi-2")).toBe(1);
  });

  it("kommt mit einer in Codezaeune gepackten Antwort zurecht", () => {
    const hinweis = parseTagesgruppen('```json\n{"tage": [[2]]}\n```', POIS, 3);

    expect(hinweis?.get("poi-2")).toBe(0);
  });

  it("uebergeht unbekannte Nummern und Tage jenseits der Reise", () => {
    const hinweis = parseTagesgruppen(
      '{"tage": [[99], [1], [2], [3]]}',
      POIS,
      2,
    );

    expect(hinweis?.has("poi-3")).toBe(false);
    expect(hinweis?.get("poi-1")).toBe(1);
  });

  it("liefert null, wenn die Antwort keine Tagesgruppen enthaelt", () => {
    expect(
      parseTagesgruppen("Gerne! Hier mein Vorschlag …", POIS, 3),
    ).toBeNull();
    expect(parseTagesgruppen('{"orte": [1]}', POIS, 3)).toBeNull();
  });
});

describe("buildGruppenPrompt (req-056)", () => {
  it("nennt die Reisetage, die POIs und die Regeln des Reisetempos", () => {
    const prompt = buildGruppenPrompt({
      trip: trip("entspannt"),
      tage: TAGE,
      pois: [poi(1), poi(2, { type: "restaurant" })],
    });

    expect(prompt).toContain("3 Reisetage");
    expect(prompt).toContain("1. Ort 1 (Sehenswürdigkeit");
    expect(prompt).toContain("2. Ort 2 (Restaurant");
    expect(prompt).toContain("hoechstens 6 Stunden");
    expect(prompt).toContain("Hoechstens 2 Orte desselben Typs");
  });
});

describe("erstellePlanvorschlag (req-056)", () => {
  it("verteilt sechs gesetzte POIs auf alle drei Reisetage", async () => {
    const pois = [1, 2, 3, 4, 5, 6].map((nummer) => poi(nummer));

    const vorschlag = await erstellePlanvorschlag(
      { trip: trip(), pois, activities: [], neuOrdnen: false },
      deps('{"tage": [[1, 2], [3, 4], [5, 6]]}'),
    );

    const tage = new Set(vorschlag!.punkte.map((p) => tagVon(p.startAt)));
    expect([...tage].sort()).toEqual(TAGE);
    expect(vorschlag!.ohnePlatz).toBe(0);
  });

  it("verplant POIs mit Status „Weiß noch nicht“ nicht", async () => {
    const pois = [
      poi(1),
      poi(2, { status: "weiss_nicht" }),
      poi(3, { status: "auf_keinen_fall" }),
      poi(4, { status: "wahrscheinlich" }),
    ];

    const vorschlag = await erstellePlanvorschlag(
      { trip: trip(), pois, activities: [], neuOrdnen: false },
      deps('{"tage": [[1, 2, 3, 4]]}'),
    );

    expect(vorschlag!.punkte.map((punkt) => punkt.poiId).sort()).toEqual([
      "poi-1",
      "poi-4",
    ]);
  });

  it("plant ein Restaurant zwischen 12:00 und 14:00", async () => {
    const pois = [poi(1), poi(2, { type: "restaurant" })];

    const vorschlag = await erstellePlanvorschlag(
      { trip: trip(), pois, activities: [], neuOrdnen: false },
      deps('{"tage": [[1, 2]]}'),
    );

    const restaurant = vorschlag!.punkte.find(
      (punkt) => punkt.poiId === "poi-2",
    );
    expect(restaurant?.startAt.slice(11)).toBe("12:00");
    expect(restaurant?.endAt.slice(11)).toBe("14:00");
  });

  it("nennt die POIs, die keinen Platz fanden", async () => {
    const pois = Array.from({ length: 20 }, (_, index) => poi(index + 1));

    const vorschlag = await erstellePlanvorschlag(
      {
        trip: { ...trip("entspannt"), endDate: TAGE[1] },
        pois,
        activities: [],
        neuOrdnen: false,
      },
      deps('{"tage": [[], []]}'),
    );

    expect(vorschlag!.ohnePlatz).toBeGreaterThan(0);
    expect(vorschlag!.punkte.length + vorschlag!.ohnePlatz).toBe(20);
  });

  it("liefert null, wenn die KI nicht antwortet", async () => {
    const vorschlag = await erstellePlanvorschlag(
      { trip: trip(), pois: [poi(1)], activities: [], neuOrdnen: false },
      deps(null),
    );

    expect(vorschlag).toBeNull();
  });

  it("liefert null, wenn die Antwort der KI unbrauchbar ist", async () => {
    const vorschlag = await erstellePlanvorschlag(
      { trip: trip(), pois: [poi(1)], activities: [], neuOrdnen: false },
      deps("Ich habe da mal etwas vorbereitet."),
    );

    expect(vorschlag).toBeNull();
  });

  describe("Bestehendes (req-056)", () => {
    const HOTEL_CHECKIN: Activity = {
      id: "activity-1",
      tripId: "trip-1",
      type: "hotel",
      title: "Hotel-Checkin",
      shortText: "",
      longText: "",
      startAt: `${TAGE[0]}T16:00`,
      endAt: `${TAGE[0]}T17:00`,
      poiId: "poi-9",
    };

    const HOTEL_POI = poi(9, { type: "hotel" });

    it("laesst ohne Haekchen einen bestehenden Programmpunkt an seiner Stelle", async () => {
      const vorschlag = await erstellePlanvorschlag(
        {
          trip: trip(),
          pois: [poi(1), HOTEL_POI],
          activities: [HOTEL_CHECKIN],
          neuOrdnen: false,
        },
        deps('{"tage": [[1]]}'),
      );

      const hotel = vorschlag!.punkte.find(
        (punkt) => punkt.activityId === "activity-1",
      );
      expect(hotel?.startAt).toBe(HOTEL_CHECKIN.startAt);
      expect(hotel?.endAt).toBe(HOTEL_CHECKIN.endAt);
      expect(hotel?.unveraendert).toBe(true);
    });

    it("verplant ohne Haekchen einen bereits verplanten POI kein zweites Mal", async () => {
      const vorschlag = await erstellePlanvorschlag(
        {
          trip: trip(),
          pois: [poi(1), HOTEL_POI],
          activities: [HOTEL_CHECKIN],
          neuOrdnen: false,
        },
        deps('{"tage": [[1, 9]]}'),
      );

      const zumHotel = vorschlag!.punkte.filter(
        (punkt) => punkt.poiId === "poi-9",
      );
      expect(zumHotel).toHaveLength(1);
    });

    it("ordnet mit Haekchen den bestehenden Programmpunkt neu, ohne ihn zu verdoppeln", async () => {
      const vorschlag = await erstellePlanvorschlag(
        {
          trip: trip(),
          pois: [poi(1), HOTEL_POI],
          activities: [HOTEL_CHECKIN],
          neuOrdnen: true,
        },
        deps('{"tage": [[9, 1]]}'),
      );

      const zumHotel = vorschlag!.punkte.filter(
        (punkt) => punkt.poiId === "poi-9",
      );
      expect(zumHotel).toHaveLength(1);
      // Er behaelt seine Kennung -- beim Uebernehmen wird er verschoben, nicht
      // ein zweites Mal angelegt.
      expect(zumHotel[0].activityId).toBe("activity-1");
      expect(zumHotel[0].startAt).not.toBe(HOTEL_CHECKIN.startAt);
      expect(zumHotel[0].unveraendert).toBe(false);
    });

    it("laesst einen Programmpunkt ohne POI auch mit Haekchen unangetastet", async () => {
      const anreise: Activity = {
        ...HOTEL_CHECKIN,
        id: "activity-2",
        type: "stadt_dorf",
        title: "Anreise",
        poiId: undefined,
      };

      const vorschlag = await erstellePlanvorschlag(
        {
          trip: trip(),
          pois: [poi(1)],
          activities: [anreise],
          neuOrdnen: true,
        },
        deps('{"tage": [[1]]}'),
      );

      const punkt = vorschlag!.punkte.find(
        (eintrag) => eintrag.activityId === "activity-2",
      );
      expect(punkt?.startAt).toBe(anreise.startAt);
      expect(punkt?.unveraendert).toBe(true);
    });
  });

  describe("Wege in zwei Stufen (req-056)", () => {
    it("holt fuer die Tagesgruppen die echten Fahrzeiten", async () => {
      const abhaengigkeiten = deps('{"tage": [[1, 2]]}', () => 12);

      await erstellePlanvorschlag(
        {
          // Eine Reise mit genau einem Tag: dann liegen beide POIs
          // nacheinander, und zwischen ihnen liegt ein Weg.
          trip: { ...trip(), endDate: TAGE[0] },
          pois: [poi(1), poi(2)],
          activities: [],
          neuOrdnen: false,
        },
        abhaengigkeiten,
      );

      expect(abhaengigkeiten.fahrzeitMinuten).toHaveBeenCalled();
    });

    it("verteilt neu, wenn eine echte Fahrzeit mehr als 20 Minuten ueber der geschaetzten liegt", async () => {
      const pois = [1, 2, 3, 4].map((nummer) => poi(nummer));
      const geschaetzt = deps('{"tage": [[1, 2], [3, 4]]}');
      const gemessen = deps('{"tage": [[1, 2], [3, 4]]}', () => 240);

      const ohneMessung = await erstellePlanvorschlag(
        { trip: trip(), pois, activities: [], neuOrdnen: false },
        geschaetzt,
      );
      const mitMessung = await erstellePlanvorschlag(
        { trip: trip(), pois, activities: [], neuOrdnen: false },
        gemessen,
      );

      // Vier Stunden Fahrt zwischen zwei Orten sprengen jeden Tag -- der neu
      // verteilte Plan nimmt deshalb weniger auf.
      expect(mitMessung!.punkte.length).toBeLessThan(
        ohneMessung!.punkte.length,
      );
      expect(mitMessung!.engeStellen).toEqual([]);
    });

    it("bleibt bei der Schaetzung, wenn der Routing-Dienst stumm ist", async () => {
      const pois = [poi(1), poi(2)];

      const vorschlag = await erstellePlanvorschlag(
        { trip: trip(), pois, activities: [], neuOrdnen: false },
        deps('{"tage": [[1, 2]]}', () => null),
      );

      expect(vorschlag!.punkte).toHaveLength(2);
      expect(vorschlag!.engeStellen).toEqual([]);
    });
  });
});

describe("engeStellen (req-056)", () => {
  const A = poi(1);
  const B = poi(2);

  const verteilung = {
    punkte: [
      { poi: A, startAt: `${TAGE[0]}T08:00`, endAt: `${TAGE[0]}T10:30` },
      { poi: B, startAt: `${TAGE[0]}T11:00`, endAt: `${TAGE[0]}T13:30` },
    ],
    ohnePlatz: [],
  };

  function gemessenMit(minuten: number) {
    return new Map([
      [
        `${A.position.lat},${A.position.lng}->${B.position.lat},${B.position.lng}`,
        minuten,
      ],
    ]);
  }

  it("nennt die Stelle, an der die Fahrzeit nicht in die Luecke passt", () => {
    expect(engeStellen(verteilung, gemessenMit(45))).toEqual([
      "„Ort 1“ → „Ort 2“: 45 min Fahrzeit, nur 30 min Lücke.",
    ]);
  });

  it("schweigt, wenn die Fahrzeit in die Luecke passt", () => {
    expect(engeStellen(verteilung, gemessenMit(20))).toEqual([]);
  });
});

describe("vorschlagAlsActivities (req-056)", () => {
  it("macht aus dem Vorschlag Programmpunkte fuer die Anzeige", async () => {
    const vorschlag = await erstellePlanvorschlag(
      { trip: trip(), pois: [poi(1)], activities: [], neuOrdnen: false },
      deps('{"tage": [[1]]}'),
    );

    const activities = vorschlagAlsActivities(vorschlag!, "trip-1");

    expect(activities).toHaveLength(1);
    expect(activities[0].tripId).toBe("trip-1");
    expect(activities[0].poiId).toBe("poi-1");
    expect(activities[0].id).toBe("vorschlag-0");
  });
});
