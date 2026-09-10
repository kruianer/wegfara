import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { MapLibreMap } from "@/tests/mocks/maplibre-gl";
import { DayRouteMap } from "./day-route-map";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { TripDay } from "@/lib/trips/days";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Die Linien der Tageskarte im Planer (req-011, req-059): dem Strassenverlauf
 * folgend, wo einer zu haben ist, sonst die gepunktete Gerade.
 */

const TAG = "2026-07-18";
const DAYS: TripDay[] = [{ date: TAG, weekday: "Sa" }];
const AMALFI = { name: "Amalfi", lat: 40.634, lng: 14.6027 };

function programmpunkt(
  id: string,
  startAt: string,
  position: { lat: number; lng: number },
): Activity {
  return {
    id,
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: `Programmpunkt ${id}`,
    shortText: "",
    longText: "",
    startAt: `${TAG}T${startAt}`,
    endAt: `${TAG}T${startAt}`,
    position,
  };
}

const DOM = programmpunkt("a1", "10:00", { lat: 40.634, lng: 14.602 });
const HAFEN = programmpunkt("a2", "12:00", { lat: 40.628, lng: 14.484 });

const MIT_AUTO: Transfer = {
  id: "t1",
  tripId: "trip-1",
  fromActivityId: DOM.id,
  toActivityId: HAFEN.id,
  mode: "auto",
  title: "Fahrt nach Positano",
  durationMin: 25,
  distanceKm: 16,
};

/** Der Strassenverlauf, den der Server zu diesem Transfer meldet. */
const STRASSE = [
  { lat: 40.634, lng: 14.602 },
  { lat: 40.633, lng: 14.56 },
  { lat: 40.63, lng: 14.51 },
  { lat: 40.628, lng: 14.484 },
];

function mockServer(verlaeufe: Record<string, unknown> | "stumm") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (verlaeufe === "stumm") throw new Error("network down");
      return Response.json({ verlaeufe });
    }),
  );
}

/** Die Linien, wie sie in der Kartenquelle liegen. */
function linien() {
  const source = MapLibreMap.live().getSource("day-route-lines");
  return (source?.data.features ?? []) as GeoJSON.Feature[];
}

async function karte(activities: Activity[], transfers: Transfer[]) {
  render(
    <DayRouteMap
      days={DAYS}
      selectedDate={TAG}
      mainPlace={AMALFI}
      activities={activities}
      transfers={transfers}
    />,
  );
  // Die Karte misst sich erst im naechsten Frame (siehe bug-003).
  await act(async () => {
    await new Promise((fertig) => requestAnimationFrame(() => fertig(null)));
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  MapLibreMap.instances.length = 0;
});

describe("Tageskarte im Planer (req-059)", () => {
  it("laesst die Linie eines Transfers dem Strassenverlauf folgen", async () => {
    mockServer({ [MIT_AUTO.id]: STRASSE });

    await karte([DOM, HAFEN], [MIT_AUTO]);

    await waitFor(() => expect(linien()[0]?.properties?.gerade).toBe(false));
    expect(
      (linien()[0].geometry as GeoJSON.LineString).coordinates,
    ).toHaveLength(STRASSE.length);
  });

  it("verbindet zwei Programmpunkte ohne Transfer mit der gepunkteten Geraden", async () => {
    mockServer({});

    await karte([DOM, HAFEN], []);

    expect(linien()).toHaveLength(1);
    expect(linien()[0].properties?.gerade).toBe(true);
    expect(
      (linien()[0].geometry as GeoJSON.LineString).coordinates,
    ).toHaveLength(2);
  });

  it("zeigt die Gerade und keine Fehlermeldung, wenn der Dienst schweigt", async () => {
    mockServer("stumm");

    const { container } = render(
      <DayRouteMap
        days={DAYS}
        selectedDate={TAG}
        mainPlace={AMALFI}
        activities={[DOM, HAFEN]}
        transfers={[MIT_AUTO]}
      />,
    );
    await act(async () => {
      await new Promise((fertig) => requestAnimationFrame(() => fertig(null)));
    });

    expect(linien()[0].properties?.gerade).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain("Fehler");
  });

  it("holt fuer einen Transfer per Flug keinen Strassenverlauf", async () => {
    // Der Server liefert dafuer nichts (req-059) -- die Linie bleibt gerade.
    mockServer({});

    await karte([DOM, HAFEN], [{ ...MIT_AUTO, mode: "flug" }]);

    await waitFor(() => expect(linien()).toHaveLength(1));
    expect(linien()[0].properties?.gerade).toBe(true);
  });

  it("holt den Verlauf nicht bei jedem Durchlauf neu", async () => {
    mockServer({ [MIT_AUTO.id]: STRASSE });

    await karte([DOM, HAFEN], [MIT_AUTO]);
    await waitFor(() => expect(linien()[0]?.properties?.gerade).toBe(false));

    expect(
      (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls,
    ).toHaveLength(1);
  });
});
