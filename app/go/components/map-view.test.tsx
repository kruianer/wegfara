import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("MapView", () => {
  it("zeigt fuer vier Programmpunkte vier nummerierte Marker", () => {
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

    expect(screen.getAllByRole("button", { name: /^\d+\. / })).toHaveLength(4);
  });

  it("traegt der zeitlich erste Marker die Ziffer 1", () => {
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

    expect(
      screen.getByRole("button", { name: "1. Erster Punkt" }),
    ).toBeInTheDocument();
  });

  it("oeffnet beim Antippen eines Markers eine Sprechblase mit dem Titel", async () => {
    const user = userEvent.setup();
    renderMap({ activities: [activity({ title: "Dom von Amalfi" })] });

    await user.click(screen.getByRole("button", { name: "1. Dom von Amalfi" }));

    const popup = screen.getByRole("tooltip");
    expect(popup).toHaveTextContent("1. Dom von Amalfi");
    expect(popup).toHaveTextContent("10:00 – 12:30");
  });

  it("zeigt fuer eine Options-Gruppe aus drei Alternativen genau einen Marker", () => {
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

    expect(screen.getAllByRole("button", { name: /^\d+\. / })).toHaveLength(1);
  });

  it("verbindet zwei Programmpunkte mit einem Auto-Transfer durchgezogen", () => {
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

    const data = lastMap().getSource("transfer-lines")!.data;
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties).toEqual({ dashed: false });
  });

  it("verbindet zwei Programmpunkte mit einem Fuss-Transfer gestrichelt", () => {
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

    const data = lastMap().getSource("transfer-lines")!.data;
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties).toEqual({ dashed: true });
  });

  it("zeichnet keine Linie zwischen zwei Programmpunkten ohne hinterlegten Transfer", () => {
    const activities = [
      activity({ id: "a1" }),
      activity({
        id: "a2",
        startAt: "2026-07-18T13:00",
        endAt: "2026-07-18T14:00",
      }),
    ];
    renderMap({ activities, transfers: [] });

    const data = lastMap().getSource("transfer-lines")!.data;
    expect(data.features).toHaveLength(0);
  });

  it("waehlt den Kartenausschnitt so, dass alle Marker sichtbar sind", () => {
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

    const map = lastMap();
    expect(map.fitBoundsCalls).toHaveLength(1);
    expect(map.fitBoundsCalls[0].bounds.toArray()).toEqual([
      [14.6, 40.6],
      [14.9, 40.8],
    ]);
  });

  it("zeigt fuer einen Reisetag ohne Programmpunkte keinen Marker", () => {
    renderMap({ activities: [] });

    expect(
      screen.queryByRole("button", { name: /^\d+\. / }),
    ).not.toBeInTheDocument();
  });

  it("zentriert die Karte auf den Hauptort, wenn der Reisetag keine Programmpunkte hat", () => {
    renderMap({ activities: [] });

    expect(lastMap().center).toEqual([MAIN_PLACE.lng, MAIN_PLACE.lat]);
  });

  it("korrigiert die Kartengroesse direkt nach dem Aktivieren des Kartenbereichs (bug-001)", () => {
    renderMap({ activities: [] });

    expect(lastMap().resizeCalls).toBeGreaterThan(0);
  });

  it("passt die Kartengroesse bei einer Fensteraenderung an (bug-001)", () => {
    renderMap({ activities: [] });
    const callsAfterMount = lastMap().resizeCalls;

    window.dispatchEvent(new Event("resize"));

    expect(lastMap().resizeCalls).toBeGreaterThan(callsAfterMount);
  });
});
