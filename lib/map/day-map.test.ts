import { describe, expect, it } from "vitest";
import { buildDayMap } from "./day-map";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Programmpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T11:00",
    position: { lat: 40.6, lng: 14.6 },
    ...overrides,
  };
}

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "t1",
    tripId: "trip-1",
    fromActivityId: "a1",
    toActivityId: "a2",
    mode: "auto",
    title: "Fahrt",
    durationMin: 10,
    distanceKm: 2,
    ...overrides,
  };
}

describe("buildDayMap", () => {
  it("erzeugt fuer vier Programmpunkte vier Marker", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T09:00",
        endAt: "2026-07-18T09:30",
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T10:30",
      }),
      activity({
        id: "a3",
        startAt: "2026-07-18T11:00",
        endAt: "2026-07-18T11:30",
      }),
      activity({
        id: "a4",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T12:30",
      }),
    ];

    const { markers } = buildDayMap(activities, []);

    expect(markers).toHaveLength(4);
  });

  it("zaehlt den zeitlich ersten Programmpunkt als ersten des Tages", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T09:00",
        endAt: "2026-07-18T09:30",
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T10:30",
      }),
    ];

    const { markers } = buildDayMap(activities, []);

    expect(markers[0]).toMatchObject({
      reihenfolge: 1,
      activity: activities[0],
    });
    expect(markers[1]).toMatchObject({
      reihenfolge: 2,
      activity: activities[1],
    });
  });

  it("zeigt fuer eine Options-Gruppe genau einen Marker mit der gewaehlten Alternative", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
        position: { lat: 1, lng: 1 },
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
        position: { lat: 2, lng: 2 },
      }),
      activity({
        id: "a3",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
        position: { lat: 3, lng: 3 },
      }),
    ];

    const { markers } = buildDayMap(activities, [], {
      "trip-1|2026-07-18T13:30|2026-07-18T15:00": "a2",
    });

    expect(markers).toHaveLength(1);
    expect(markers[0].activity.id).toBe("a2");
    expect(markers[0].isGroup).toBe(true);
  });

  it("waehlt ohne gespeicherte Auswahl die erste Alternative einer Options-Gruppe", () => {
    const activities = [
      activity({
        id: "a1",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
      }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
      }),
    ];

    const { markers } = buildDayMap(activities, []);

    expect(markers).toHaveLength(1);
    expect(markers[0].activity.id).toBe("a1");
  });

  it("zeigt keinen Marker fuer einen Programmpunkt ohne Position", () => {
    const activities = [activity({ position: undefined })];

    const { markers } = buildDayMap(activities, []);

    expect(markers).toHaveLength(0);
  });

  it("verbindet zwei Programmpunkte mit hinterlegtem Transfer per Auto durchgezogen", () => {
    const activities = [
      activity({ id: "a1", position: { lat: 1, lng: 1 } }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
        position: { lat: 2, lng: 2 },
      }),
    ];
    const transfers = [transfer({ mode: "auto" })];

    const { lines } = buildDayMap(activities, transfers);

    expect(lines).toEqual([
      {
        mode: "auto",
        from: { lat: 1, lng: 1 },
        to: { lat: 2, lng: 2 },
        transferId: "t1",
        verlauf: [
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
        ],
        gerade: true,
        vonPoiNummer: null,
        nachPoiNummer: null,
      },
    ]);
  });

  it("verbindet zwei Programmpunkte mit hinterlegtem Transfer zu Fuss gestrichelt", () => {
    const activities = [
      activity({ id: "a1", position: { lat: 1, lng: 1 } }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
        position: { lat: 2, lng: 2 },
      }),
    ];
    const transfers = [transfer({ mode: "fuss" })];

    const { lines } = buildDayMap(activities, transfers);

    expect(lines).toMatchObject([
      { mode: "fuss", from: { lat: 1, lng: 1 }, to: { lat: 2, lng: 2 } },
    ]);
  });

  it("verbindet den Ausgangspunkt der Anreise per Flug mit dem ersten Programmpunkt am Zielort (req-018)", () => {
    const activities = [
      activity({
        id: "wien",
        type: "stadt_dorf",
        title: "Wien",
        startAt: "2026-07-18T06:00",
        endAt: "2026-07-18T07:00",
        position: { lat: 48.2082, lng: 16.3738 },
      }),
      activity({
        id: "neapel",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T12:00",
        position: { lat: 40.8518, lng: 14.2681 },
      }),
    ];
    const transfers = [
      transfer({
        fromActivityId: "wien",
        toActivityId: "neapel",
        mode: "flug",
      }),
    ];

    const { lines } = buildDayMap(activities, transfers);

    expect(lines).toMatchObject([
      {
        mode: "flug",
        from: { lat: 48.2082, lng: 16.3738 },
        to: { lat: 40.8518, lng: 14.2681 },
      },
    ]);
  });

  it("zeichnet keine Linie zwischen zwei aufeinanderfolgenden Programmpunkten ohne Transfer", () => {
    const activities = [
      activity({ id: "a1" }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
      }),
    ];

    const { lines } = buildDayMap(activities, []);

    expect(lines).toHaveLength(0);
  });

  it("zeichnet keine Linie, wenn der Zielpunkt des Transfers keine Position hat", () => {
    const activities = [
      activity({ id: "a1", position: { lat: 1, lng: 1 } }),
      activity({
        id: "a2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
        position: undefined,
      }),
    ];
    const transfers = [transfer()];

    const { lines } = buildDayMap(activities, transfers);

    expect(lines).toHaveLength(0);
  });

  it("liefert keine Marker fuer einen Reisetag ohne Programmpunkte", () => {
    const { markers, lines } = buildDayMap([], []);

    expect(markers).toHaveLength(0);
    expect(lines).toHaveLength(0);
  });

  /**
   * Jede Linie nennt die Nummern der beiden Marker, zwischen denen sie
   * liegt -- daran haengt der Richtungspfeil (req-075). Ein Transfer zaehlt
   * dabei nicht mit: er steht zwischen den Nummern, nicht auf einer.
   */
  it("nennt zu jeder Linie die POI-Nummern ihrer beiden Programmpunkte", () => {
    const activities = [
      activity({ id: "a1", poiId: "poi-1", position: { lat: 1, lng: 1 } }),
      activity({
        id: "a2",
        poiId: "poi-2",
        startAt: "2026-07-18T12:00",
        endAt: "2026-07-18T13:00",
        position: { lat: 2, lng: 2 },
      }),
      activity({
        id: "a3",
        poiId: "poi-3",
        startAt: "2026-07-18T14:00",
        endAt: "2026-07-18T15:00",
        position: { lat: 3, lng: 3 },
      }),
    ];

    const { lines } = buildDayMap(
      activities,
      [transfer({ mode: "auto" })],
      {},
      {
        verbindeOhneTransfer: true,
        poiNummern: new Map([
          ["poi-1", 14],
          ["poi-2", 3],
          ["poi-3", 8],
        ]),
      },
    );

    expect(
      lines.map(({ vonPoiNummer, nachPoiNummer }) => [
        vonPoiNummer,
        nachPoiNummer,
      ]),
    ).toEqual([
      [14, 3],
      [3, 8],
    ]);
  });
});

/**
 * Die Zahl an einem Marker ist die POI-Nummer, nicht ein Laufzaehler des Tages
 * (bug-055): eine Zahl an einem Ort bedeutet ueberall dasselbe. Der Laufzaehler
 * bleibt als `reihenfolge` erhalten -- der Begleiter beschriftet damit seine
 * Marker (req-008) --, aber er beschriftet im Planer keinen mehr.
 */
describe("buildDayMap -- die Zahl am Marker ist die POI-Nummer (bug-055)", () => {
  /** Zwei Programmpunkte, in der Tagesfolge 1 und 2, als POI 14 und POI 3. */
  const VERPLANT = [
    activity({ id: "a1", poiId: "poi-pompeji", position: { lat: 1, lng: 1 } }),
    activity({
      id: "a2",
      poiId: "poi-villa",
      startAt: "2026-07-18T12:00",
      endAt: "2026-07-18T13:00",
      position: { lat: 2, lng: 2 },
    }),
  ];

  const NUMMERN = new Map([
    ["poi-pompeji", 14],
    ["poi-villa", 3],
  ]);

  it("gibt jedem Marker die Nummer des POI, aus dem er entstanden ist", () => {
    const { markers } = buildDayMap(VERPLANT, [], {}, { poiNummern: NUMMERN });

    expect(markers.map(({ poiNummer }) => poiNummer)).toEqual([14, 3]);
  });

  it("zaehlt die Tagesfolge weiter mit, getrennt von der POI-Nummer", () => {
    const { markers } = buildDayMap(VERPLANT, [], {}, { poiNummern: NUMMERN });

    expect(
      markers.map(({ poiNummer, reihenfolge }) => [poiNummer, reihenfolge]),
    ).toEqual([
      [14, 1],
      [3, 2],
    ]);
  });

  it("gibt einem Programmpunkt ohne POI keine Nummer", () => {
    // Von Hand angelegt (req-018): er hat keine POI-Nummer, und eine Zahl aus
    // einer eigenen Zaehlung bekommt er nicht.
    const { markers } = buildDayMap(
      [activity({ id: "a1", poiId: undefined })],
      [],
      {},
      { poiNummern: NUMMERN },
    );

    expect(markers[0].poiNummer).toBeNull();
    expect(markers[0].reihenfolge).toBe(1);
  });

  it("erfindet keine Nummer, wenn der POI nicht mehr gefuehrt wird", () => {
    const { markers } = buildDayMap(
      [activity({ id: "a1", poiId: "poi-fremd" })],
      [],
      {},
      { poiNummern: NUMMERN },
    );

    expect(markers[0].poiNummer).toBeNull();
  });

  it("laesst die Marker ohne mitgegebene Nummern zahlenlos", () => {
    // Der Begleiter gibt keine mit (req-008) -- er beschriftet seine Marker mit
    // der Reihenfolge.
    const { markers } = buildDayMap(VERPLANT, []);

    expect(markers.map(({ poiNummer }) => poiNummer)).toEqual([null, null]);
    expect(markers.map(({ reihenfolge }) => reihenfolge)).toEqual([1, 2]);
  });

  it("nimmt bei einer Options-Gruppe die Nummer der gewaehlten Alternative", () => {
    const alternativen = [
      activity({
        id: "a1",
        poiId: "poi-pompeji",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
      }),
      activity({
        id: "a2",
        poiId: "poi-villa",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
      }),
    ];

    const { markers } = buildDayMap(
      alternativen,
      [],
      { "trip-1|2026-07-18T13:30|2026-07-18T15:00": "a2" },
      { poiNummern: NUMMERN },
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ poiNummer: 3, reihenfolge: 1 });
  });

  it("nennt an einer Linie keine Nummer, wo ein Ende keine hat", () => {
    // Sonst stuende an einem Pfeil eine Zahl, die zu keinem Marker gehoert.
    const { lines } = buildDayMap(
      [VERPLANT[0], { ...VERPLANT[1], poiId: undefined }],
      [transfer({ mode: "auto" })],
      {},
      { poiNummern: NUMMERN },
    );

    expect(lines[0]).toMatchObject({ vonPoiNummer: 14, nachPoiNummer: null });
  });
});

describe("buildDayMap -- Strassenverlauf (req-059)", () => {
  /** Zwei Programmpunkte nacheinander, beide mit Position. */
  const ZWEI = [
    activity({ id: "a1", position: { lat: 1, lng: 1 } }),
    activity({
      id: "a2",
      startAt: "2026-07-18T12:00",
      endAt: "2026-07-18T13:00",
      position: { lat: 2, lng: 2 },
    }),
  ];

  /** Der Strassenverlauf, wie ihn der Routing-Dienst meldet. */
  const STRASSE = [
    { lat: 1, lng: 1 },
    { lat: 1.4, lng: 1.2 },
    { lat: 1.6, lng: 1.9 },
    { lat: 2, lng: 2 },
  ];

  it("laesst die Linie eines Transfers dem Strassenverlauf folgen", () => {
    const { lines } = buildDayMap(
      ZWEI,
      [transfer({ mode: "auto" })],
      {},
      { verlaeufe: { t1: STRASSE } },
    );

    expect(lines[0].verlauf).toEqual(STRASSE);
    expect(lines[0].gerade).toBe(false);
  });

  it("zieht die Gerade, wenn zu diesem Transfer kein Verlauf vorliegt", () => {
    // Der Routing-Dienst ist stumm -- die Karte zeigt die gepunktete Gerade.
    const { lines } = buildDayMap(ZWEI, [transfer({ mode: "auto" })], {}, {});

    expect(lines[0].verlauf).toEqual([
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
    ]);
    expect(lines[0].gerade).toBe(true);
  });

  it("zeichnet fuer einen Transfer per Flug keinen Strassenverlauf", () => {
    // Fuer Flug, Bahn, Boot und Faehre ermittelt niemand einen Verlauf.
    const { lines } = buildDayMap(ZWEI, [transfer({ mode: "flug" })], {}, {});

    expect(lines[0].gerade).toBe(true);
    expect(lines[0].verlauf).toHaveLength(2);
  });

  it("verbindet im Planer auch zwei Programmpunkte ohne Transfer gerade", () => {
    const { lines } = buildDayMap(ZWEI, [], {}, { verbindeOhneTransfer: true });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      mode: null,
      transferId: null,
      gerade: true,
    });
    expect(lines[0].verlauf).toEqual([
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
    ]);
  });

  it("zieht neben einem Transfer keine zweite Linie", () => {
    const { lines } = buildDayMap(
      ZWEI,
      [transfer({ mode: "auto" })],
      {},
      { verbindeOhneTransfer: true, verlaeufe: { t1: STRASSE } },
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].gerade).toBe(false);
  });

  it("verbindet im Begleiter zwei Programmpunkte ohne Transfer weiterhin nicht", () => {
    // Dort bleibt es bei req-008: ohne Transfer keine Linie.
    expect(buildDayMap(ZWEI, []).lines).toHaveLength(0);
  });
});

describe("buildDayMap -- Reisetag ohne Programmpunkte", () => {
  it("liefert weder Marker noch Linien", () => {
    const { markers, lines } = buildDayMap([], []);

    expect(markers).toHaveLength(0);
    expect(lines).toHaveLength(0);
  });
});
