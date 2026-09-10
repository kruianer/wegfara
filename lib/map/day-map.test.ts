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

  it("nummeriert den zeitlich ersten Programmpunkt mit 1", () => {
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

    expect(markers[0]).toMatchObject({ number: 1, activity: activities[0] });
    expect(markers[1]).toMatchObject({ number: 2, activity: activities[1] });
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
