import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapView } from "./map-view";
import { MapLibreMap } from "@/tests/mocks/maplibre-gl";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { TripDay } from "@/lib/trips/days";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const DAYS: TripDay[] = [{ date: "2026-07-18", weekday: "Sa" }];
const MAIN_PLACE = { name: "Amalfi", lat: 40.6333, lng: 14.6027 };

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Dom von Amalfi",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T12:30",
    position: { lat: 40.6343, lng: 14.6027 },
    ...overrides,
  };
}

function renderMap(props: {
  activities: Activity[];
  transfers?: Transfer[];
  optionSelections?: Record<string, string>;
}) {
  return render(
    <MapView
      days={DAYS}
      selectedDate="2026-07-18"
      onSelectDate={() => {}}
      mainPlace={MAIN_PLACE}
      activities={props.activities}
      transfers={props.transfers}
      optionSelections={props.optionSelections}
    />,
  );
}

function lastMap() {
  return MapLibreMap.instances.at(-1)!;
}

// Die Groessenkorrektur nach dem Mounten wartet einen Frame ab, bevor sie
// Kartenausschnitt und Marker anlegt (bug-003) — Tests, die danach fragen,
// muessen diesen Frame erst abwarten.
async function flushMapReady() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

describe("MapView", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("legt keine Ebenen und Marker an, solange der Kartenstil noch nicht geladen ist, und holt beides nach dem Laden nach (bug-002)", async () => {
    MapLibreMap.startStyleLoaded = false;
    renderMap({ activities: [activity({ title: "Dom von Amalfi" })] });

    const map = lastMap();
    expect(map.getSource("transfer-lines")).toBeUndefined();
    expect(
      screen.queryByRole("button", { name: /^\d+\. / }),
    ).not.toBeInTheDocument();

    await flushMapReady();

    act(() => {
      map.simulateStyleLoad();
    });

    expect(map.getSource("transfer-lines")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "1. Dom von Amalfi" }),
    ).toBeInTheDocument();
  });

  it("ist die Karte noch unscharf (Groesse noch nicht korrigiert), legt sie weder Marker noch Kartenausschnitt an, und holt beides nach dem naechsten Frame nach (bug-003)", async () => {
    renderMap({ activities: [activity({ title: "Dom von Amalfi" })] });

    const map = lastMap();
    expect(map.resizeCalls).toBe(0);
    expect(map.fitBoundsCalls).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /^\d+\. / }),
    ).not.toBeInTheDocument();

    await flushMapReady();

    expect(map.resizeCalls).toBeGreaterThan(0);
    expect(map.fitBoundsCalls).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "1. Dom von Amalfi" }),
    ).toBeInTheDocument();
  });

  it("nutzt eine hoehere Kachelaufloesung, damit Beschriftungen auf Geraeten mit doppelter Pixeldichte lesbar bleiben (bug-003)", () => {
    renderMap({ activities: [] });

    const style = lastMap().style as {
      sources: Record<string, { tileSize?: number }>;
    };
    expect(style.sources.osm.tileSize).toBe(512);
  });

  it("zeigt fuer vier Programmpunkte vier nummerierte Marker", async () => {
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
    renderMap({ activities });
    await flushMapReady();

    expect(screen.getAllByRole("button", { name: /^\d+\. / })).toHaveLength(4);
  });

  it("traegt der zeitlich erste Marker die Ziffer 1", async () => {
    const activities = [
      activity({
        id: "a1",
        title: "Erster Punkt",
        startAt: "2026-07-18T09:00",
        endAt: "2026-07-18T09:30",
      }),
      activity({
        id: "a2",
        title: "Zweiter Punkt",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T10:30",
      }),
    ];
    renderMap({ activities });
    await flushMapReady();

    expect(
      screen.getByRole("button", { name: "1. Erster Punkt" }),
    ).toBeInTheDocument();
  });

  it("oeffnet beim Antippen eines Markers eine Sprechblase mit dem Titel", async () => {
    const user = userEvent.setup();
    renderMap({ activities: [activity({ title: "Dom von Amalfi" })] });
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "1. Dom von Amalfi" }));

    const popup = screen.getByRole("tooltip");
    expect(popup).toHaveTextContent("1. Dom von Amalfi");
    expect(popup).toHaveTextContent("10:00 – 12:30");
  });

  it("zeigt fuer eine Options-Gruppe aus drei Alternativen genau einen Marker", async () => {
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
      activity({
        id: "a3",
        startAt: "2026-07-18T13:30",
        endAt: "2026-07-18T15:00",
      }),
    ];
    renderMap({ activities });
    await flushMapReady();

    expect(screen.getAllByRole("button", { name: /^\d+\. / })).toHaveLength(1);
  });

  it("verbindet zwei Programmpunkte mit einem Auto-Transfer durchgezogen", async () => {
    const activities = [
      activity({ id: "a1" }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:00",
        endAt: "2026-07-18T14:00",
        position: { lat: 40.63, lng: 14.6 },
      }),
    ];
    const transfers: Transfer[] = [
      {
        id: "t1",
        tripId: "trip-1",
        fromActivityId: "a1",
        toActivityId: "a2",
        mode: "auto",
        title: "Fahrt",
        durationMin: 10,
        distanceKm: 2,
      },
    ];
    renderMap({ activities, transfers });
    await flushMapReady();

    const data = lastMap().getSource("transfer-lines")!.data;
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties).toEqual({ dashed: false });
  });

  it("verbindet zwei Programmpunkte mit einem Fuss-Transfer gestrichelt", async () => {
    const activities = [
      activity({ id: "a1" }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:00",
        endAt: "2026-07-18T14:00",
        position: { lat: 40.63, lng: 14.6 },
      }),
    ];
    const transfers: Transfer[] = [
      {
        id: "t1",
        tripId: "trip-1",
        fromActivityId: "a1",
        toActivityId: "a2",
        mode: "fuss",
        title: "Spaziergang",
        durationMin: 8,
        distanceKm: 0.4,
      },
    ];
    renderMap({ activities, transfers });
    await flushMapReady();

    const data = lastMap().getSource("transfer-lines")!.data;
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties).toEqual({ dashed: true });
  });

  it("zeichnet keine Linie zwischen zwei Programmpunkten ohne hinterlegten Transfer", async () => {
    const activities = [
      activity({ id: "a1" }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:00",
        endAt: "2026-07-18T14:00",
      }),
    ];
    renderMap({ activities, transfers: [] });
    await flushMapReady();

    const data = lastMap().getSource("transfer-lines")!.data;
    expect(data.features).toHaveLength(0);
  });

  it("waehlt den Kartenausschnitt so, dass alle Marker sichtbar sind", async () => {
    const activities = [
      activity({ id: "a1", position: { lat: 40.6, lng: 14.6 } }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:00",
        endAt: "2026-07-18T14:00",
        position: { lat: 40.8, lng: 14.9 },
      }),
    ];
    renderMap({ activities });
    await flushMapReady();

    const map = lastMap();
    expect(map.fitBoundsCalls).toHaveLength(1);
    expect(map.fitBoundsCalls[0].bounds.toArray()).toEqual([
      [14.6, 40.6],
      [14.9, 40.8],
    ]);
  });

  describe("An- und Abreise als Transfer (req-018)", () => {
    const WIEN = { lat: 48.2082, lng: 16.3738 };
    const NEAPEL = [
      { lat: 40.8518, lng: 14.2681 },
      { lat: 40.8467, lng: 14.2497 },
      { lat: 40.8358, lng: 14.2488 },
    ];

    function ersterReisetag() {
      return {
        activities: [
          activity({
            id: "wien",
            type: "stadt_dorf" as const,
            title: "Wien",
            startAt: "2026-07-18T06:00",
            endAt: "2026-07-18T07:00",
            position: WIEN,
          }),
          ...NEAPEL.map((position, index) =>
            activity({
              id: `neapel-${index}`,
              title: `Neapel ${index + 1}`,
              startAt: `2026-07-18T1${index}:00`,
              endAt: `2026-07-18T1${index}:30`,
              position,
            }),
          ),
        ],
        transfers: [
          {
            id: "anreise",
            tripId: "trip-1",
            fromActivityId: "wien",
            toActivityId: "neapel-0",
            mode: "flug" as const,
            title: "Flug Wien–Neapel",
            durationMin: 105,
            distanceKm: 815,
          },
        ],
      };
    }

    it("verbindet die Endpunkte des Fluges mit einer gestrichelten Linie", async () => {
      renderMap(ersterReisetag());
      await flushMapReady();

      const data = lastMap().getSource("transfer-lines")!.data;
      expect(data.features).toHaveLength(1);
      expect(data.features[0].properties).toEqual({ dashed: true });
      expect(data.features[0].geometry).toEqual({
        type: "LineString",
        coordinates: [
          [WIEN.lng, WIEN.lat],
          [NEAPEL[0].lng, NEAPEL[0].lat],
        ],
      });
    });

    it("haelt die Programmpunkte am Zielort im sichtbaren Ausschnitt", async () => {
      renderMap(ersterReisetag());
      await flushMapReady();

      const [[west, sued], [ost, nord]] =
        lastMap().fitBoundsCalls[0].bounds.toArray();
      for (const position of NEAPEL) {
        expect(position.lng).toBeGreaterThanOrEqual(west);
        expect(position.lng).toBeLessThanOrEqual(ost);
        expect(position.lat).toBeGreaterThanOrEqual(sued);
        expect(position.lat).toBeLessThanOrEqual(nord);
      }
    });
  });

  it("zeigt fuer einen Reisetag ohne Programmpunkte keinen Marker", async () => {
    renderMap({ activities: [] });
    await flushMapReady();

    expect(
      screen.queryByRole("button", { name: /^\d+\. / }),
    ).not.toBeInTheDocument();
  });

  it("zentriert die Karte auf den Hauptort, wenn der Reisetag keine Programmpunkte hat", async () => {
    renderMap({ activities: [] });
    await flushMapReady();

    expect(lastMap().center).toEqual([MAIN_PLACE.lng, MAIN_PLACE.lat]);
  });

  it("korrigiert die Kartengroesse direkt nach dem Aktivieren des Kartenbereichs, sobald das Layout durchgerechnet ist (bug-001, bug-003)", async () => {
    renderMap({ activities: [] });
    await flushMapReady();

    expect(lastMap().resizeCalls).toBeGreaterThan(0);
  });

  it("passt die Kartengroesse bei einer Fensteraenderung an (bug-001)", async () => {
    renderMap({ activities: [] });
    await flushMapReady();
    const callsAfterMount = lastMap().resizeCalls;

    window.dispatchEvent(new Event("resize"));

    expect(lastMap().resizeCalls).toBeGreaterThan(callsAfterMount);
  });
});

describe("MapView -- Verbindungslinien werden gezeichnet (bug-013)", () => {
  it("verarbeitet die Linien wirklich, statt sie nur in die Quelle zu legen", async () => {
    // Die Kartenbibliothek schneidet GeoJSON-Daten in einem Web Worker in
    // Kacheln. Ist er nicht erreichbar, nimmt setData() die Daten entgegen,
    // die Karte zeichnet aber nie -- lautlos, ohne Konsolenfehler (bug-013).
    const activities = [
      activity({ id: "a1" }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:00",
        endAt: "2026-07-18T14:00",
        position: { lat: 40.63, lng: 14.6 },
      }),
    ];
    const transfers: Transfer[] = [
      {
        id: "t1",
        tripId: "trip-1",
        fromActivityId: "a1",
        toActivityId: "a2",
        mode: "auto",
        title: "Fahrt",
        durationMin: 10,
        distanceKm: 2,
      },
    ];
    renderMap({ activities, transfers });
    await flushMapReady();

    expect(lastMap().querySourceFeatures("transfer-lines")).toHaveLength(1);
  });
});
