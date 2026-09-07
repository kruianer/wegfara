import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activities/types";
import type { Poi, PoiPosition, PoiStatus, PoiType } from "@/lib/pois/types";
import { REISETEMPO_REGELN } from "@/lib/trips/tempo";
import {
  belegungenAmTag,
  geschaetzteFahrzeitMinuten,
  kuerzesteReihenfolge,
  planeTag,
  poiDauerMinuten,
  verteilePois,
  type Fahrzeitschaetzung,
} from "./tagesplan";

/**
 * Die Rechenarbeit hinter "KI planen lassen" (req-056): ein Reisetag wird zu
 * einer Abfolge, und die POIs verteilen sich auf die Reisetage.
 */

const TAG = "2026-07-18";
const ZWEITER_TAG = "2026-07-19";
const DRITTER_TAG = "2026-07-20";

/** Der Hauptort der Reise -- von dort geht jeder Tag los. */
const AMALFI: PoiPosition = { lat: 40.634, lng: 14.6027 };

/** Rund einen Kilometer auseinander: zu Fuss etwa eine Viertelstunde. */
function nahBei(index: number): PoiPosition {
  return { lat: 40.634 + index * 0.01, lng: 14.6027 };
}

let nummer = 0;

function poi(
  id: string,
  {
    type = "sehenswuerdigkeit",
    status = "gesetzt",
    position = nahBei(1),
  }: { type?: PoiType; status?: PoiStatus; position?: PoiPosition } = {},
): Poi {
  nummer += 1;
  return {
    id,
    tripId: "trip-1",
    number: nummer,
    name: id,
    ort: "Amalfi",
    type,
    position,
    status,
  };
}

const AUSGEWOGEN = REISETEMPO_REGELN.ausgewogen;
const ENTSPANNT = REISETEMPO_REGELN.entspannt;

const SCHAETZUNG: Fahrzeitschaetzung = geschaetzteFahrzeitMinuten;

function tagesplan(pois: Poi[], regeln = AUSGEWOGEN, belegt = []) {
  return planeTag({
    pois,
    date: TAG,
    regeln,
    belegt,
    fahrzeit: SCHAETZUNG,
    start: AMALFI,
  });
}

/** Nur die Uhrzeiten -- so liest sich ein Tagesplan im Test wie im Zeitstrahl. */
function zeiten(punkte: { startAt: string; endAt: string }[]) {
  return punkte.map(
    (punkt) => `${punkt.startAt.slice(11)}–${punkt.endAt.slice(11)}`,
  );
}

describe("poiDauerMinuten (req-056)", () => {
  it("nimmt die geschaetzte Dauer des Typs, im 15-Minuten-Raster", () => {
    expect(poiDauerMinuten({ type: "sehenswuerdigkeit" })).toBe(150);
    expect(poiDauerMinuten({ type: "restaurant" })).toBe(120);
    expect(poiDauerMinuten({ type: "hotel" })).toBe(60);
  });
});

describe("planeTag (req-056)", () => {
  it("beginnt den Tag um 08:00", () => {
    const plan = tagesplan([poi("a")]);

    expect(plan.punkte[0].startAt).toBe(`${TAG}T08:00`);
  });

  it("laesst zwischen zwei Programmpunkten die geschaetzte Fahrzeit frei", () => {
    const plan = tagesplan([
      poi("a", { position: nahBei(0) }),
      poi("b", { position: nahBei(1) }),
    ]);

    expect(plan.punkte).toHaveLength(2);
    const luecke =
      Number(plan.punkte[1].startAt.slice(11, 13)) * 60 +
      Number(plan.punkte[1].startAt.slice(14, 16)) -
      (Number(plan.punkte[0].endAt.slice(11, 13)) * 60 +
        Number(plan.punkte[0].endAt.slice(14, 16)));
    expect(luecke).toBeGreaterThanOrEqual(
      geschaetzteFahrzeitMinuten(nahBei(0), nahBei(1)),
    );
  });

  it("plant ein Restaurant zwischen 12:00 und 14:00", () => {
    const plan = tagesplan([
      poi("a"),
      poi("mittags", { type: "restaurant", position: nahBei(2) }),
      poi("b", { position: nahBei(3) }),
    ]);

    const restaurant = plan.punkte.find((punkt) => punkt.poi.id === "mittags");
    expect(restaurant?.startAt).toBe(`${TAG}T12:00`);
    expect(restaurant?.endAt).toBe(`${TAG}T14:00`);
  });

  it("legt ohne Restaurant keinen erfundenen Programmpunkt in die Mittagszeit", () => {
    const plan = tagesplan([poi("a"), poi("b", { position: nahBei(2) })]);

    const mittags = plan.punkte.filter(
      (punkt) =>
        punkt.startAt >= `${TAG}T12:00` && punkt.startAt < `${TAG}T13:00`,
    );
    expect(mittags).toHaveLength(0);
    expect(plan.punkte.map((punkt) => punkt.poi.id)).toEqual(["a", "b"]);
  });

  it("haelt bei Tempo Entspannt die Tageslaenge von sechs Stunden ein", () => {
    const plan = tagesplan(
      [
        poi("a"),
        poi("b", { position: nahBei(2) }),
        poi("c", { position: nahBei(3) }),
      ],
      ENTSPANNT,
    );

    for (const punkt of plan.punkte) {
      expect(punkt.endAt <= `${TAG}T14:00`).toBe(true);
    }
    expect(plan.nichtGeplant.length).toBeGreaterThan(0);
  });

  it("laesst bestehende Programmpunkte unangetastet und legt sich daneben", () => {
    const bestehend: Activity = {
      id: "activity-1",
      tripId: "trip-1",
      type: "hotel",
      title: "Hotel-Checkin",
      shortText: "",
      longText: "",
      startAt: `${TAG}T08:00`,
      endAt: `${TAG}T09:00`,
    };

    const plan = planeTag({
      pois: [poi("a")],
      date: TAG,
      regeln: AUSGEWOGEN,
      belegt: belegungenAmTag([bestehend], TAG),
      fahrzeit: SCHAETZUNG,
      start: AMALFI,
    });

    expect(zeiten(plan.punkte)).toEqual(["09:00–11:30"]);
  });

  it("plant das Restaurant auch dann ein, wenn der Tag vor dem Mittag endet", () => {
    const plan = tagesplan([
      poi("mittags", { type: "restaurant", position: nahBei(1) }),
    ]);

    expect(zeiten(plan.punkte)).toEqual(["12:00–14:00"]);
  });
});

describe("kuerzesteReihenfolge (req-056)", () => {
  it("geht immer zum naechstgelegenen Ort weiter", () => {
    const fern = poi("fern", { position: { lat: 41.2, lng: 15.2 } });
    const nah = poi("nah", { position: nahBei(1) });
    const mittel = poi("mittel", { position: nahBei(4) });

    const reihenfolge = kuerzesteReihenfolge(
      [fern, mittel, nah],
      AMALFI,
      SCHAETZUNG,
    );

    expect(reihenfolge.map((p) => p.id)).toEqual(["nah", "mittel", "fern"]);
  });
});

describe("verteilePois (req-056)", () => {
  const TAGE = [TAG, ZWEITER_TAG, DRITTER_TAG];

  function verteile(pois: Poi[], regeln = AUSGEWOGEN, tage = TAGE) {
    return verteilePois({
      pois,
      tage,
      regeln,
      feste: [],
      fahrzeit: SCHAETZUNG,
      start: AMALFI,
      hinweis: new Map(),
    });
  }

  function tagVon(startAt: string) {
    return startAt.slice(0, 10);
  }

  it("verteilt sechs POIs so, dass an jedem der drei Reisetage etwas liegt", () => {
    const pois = Array.from({ length: 6 }, (_, index) =>
      poi(`poi-${index}`, { position: nahBei(index) }),
    );

    const verteilung = verteile(pois);

    const tage = new Set(
      verteilung.punkte.map((punkt) => tagVon(punkt.startAt)),
    );
    expect([...tage].sort()).toEqual(TAGE);
  });

  it("legt bei Tempo Entspannt hoechstens zwei Sehenswuerdigkeiten auf einen Tag", () => {
    const pois = Array.from({ length: 9 }, (_, index) =>
      poi(`poi-${index}`, { position: nahBei(index) }),
    );

    const verteilung = verteile(pois, ENTSPANNT);

    for (const tag of TAGE) {
      const amTag = verteilung.punkte.filter(
        (punkt) => tagVon(punkt.startAt) === tag,
      );
      expect(amTag.length).toBeLessThanOrEqual(2);
    }
  });

  it("legt bei Tempo Dicht bis zu vier Sehenswuerdigkeiten auf einen Tag", () => {
    const pois = Array.from({ length: 12 }, (_, index) =>
      poi(`poi-${index}`, { position: nahBei(index % 3) }),
    );

    const verteilung = verteilePois({
      pois,
      tage: [TAG],
      regeln: REISETEMPO_REGELN.dicht,
      feste: [],
      fahrzeit: SCHAETZUNG,
      start: AMALFI,
      hinweis: new Map(),
    });

    expect(verteilung.punkte.length).toBeLessThanOrEqual(4);
    expect(verteilung.ohnePlatz.length).toBeGreaterThan(0);
  });

  it("laesst uebrig, was in keinen Reisetag mehr passt", () => {
    const pois = Array.from({ length: 20 }, (_, index) =>
      poi(`poi-${index}`, { position: nahBei(index % 5) }),
    );

    const verteilung = verteile(pois, ENTSPANNT, [TAG, ZWEITER_TAG]);

    expect(verteilung.ohnePlatz.length).toBeGreaterThan(0);
    expect(verteilung.punkte.length + verteilung.ohnePlatz.length).toBe(20);
  });

  it("laesst ein Restaurant nicht den Platz einer Sehenswuerdigkeit belegen", () => {
    const verteilung = verteile([
      poi("sicht", { position: nahBei(1) }),
      poi("essen", { type: "restaurant", position: nahBei(2) }),
    ]);

    // Restaurant und Hotel gehoeren zum Tagesablauf und zaehlen nicht mit
    // (req-056) -- beide liegen deshalb am selben Reisetag.
    const tage = new Set(
      verteilung.punkte.map((punkt) => tagVon(punkt.startAt)),
    );
    expect(tage.size).toBe(1);
    expect(verteilung.punkte).toHaveLength(2);
  });

  it("folgt dem Vorschlag der KI, wo er die Regeln nicht bricht", () => {
    const a = poi("a", { position: nahBei(0) });
    const b = poi("b", { position: nahBei(1) });

    const verteilung = verteilePois({
      pois: [a, b],
      tage: TAGE,
      regeln: AUSGEWOGEN,
      feste: [],
      fahrzeit: SCHAETZUNG,
      start: AMALFI,
      // Beide liegen nah beieinander -- die KI will sie trotzdem trennen.
      hinweis: new Map([
        [a.id, 0],
        [b.id, 2],
      ]),
    });

    const tagVonPoi = (id: string) =>
      tagVon(
        verteilung.punkte.find((punkt) => punkt.poi.id === id)?.startAt ?? "",
      );
    expect(tagVonPoi("a")).toBe(TAG);
    expect(tagVonPoi("b")).toBe(DRITTER_TAG);
  });
});
