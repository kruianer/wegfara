import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PlanungView } from "./planung-view";
import type { Trip } from "@/lib/trips/types";
import type { Poi, PoiStatus, PoiType } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import { HOUR_HEIGHT_PX } from "@/lib/plan/timeline-grid";
import { plannedActivityFromPoi } from "@/lib/plan/plan-poi";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Das Verplanen eines POI und das Entfernen eines Programmpunkts (req-039).
 *
 * Die Ansicht selbst fuehrt die Programmpunkte nicht -- das tut ihr Aufrufer
 * (siehe app/plan/plan-view.tsx). Der Test stellt ihn nach: erst dann
 * verschwindet ein verplanter POI aus "Noch unverplant" und ein entfernter
 * Programmpunkt aus dem Zeitstrahl.
 */

const TRIP: Trip = {
  id: "trip-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};

/** Vor dem Zeitraum der Reise -- vorausgewaehlt ist damit der Anreisetag. */
const TODAY = new Date(2026, 6, 10);
const ANREISETAG = "2026-07-18";

function poi(
  id: string,
  name: string,
  type: PoiType = "sehenswuerdigkeit",
  status: PoiStatus = "gesetzt",
): Poi {
  return {
    id,
    tripId: TRIP.id,
    number: 1,
    name,
    ort: "Pompei",
    type,
    position: { lat: 40.7489, lng: 14.4989 },
    status,
  };
}

const POMPEJI = poi("poi-pompeji", "Ausgrabungsstätte Pompeji");
const VILLA_RUFOLO = poi(
  "poi-villa",
  "Villa Rufolo",
  "sehenswuerdigkeit",
  "wahrscheinlich",
);

/** Ein Programmpunkt, der aus einem POI entstanden ist -- und einer, der nicht. */
const AUS_POI: Activity = {
  id: "activity-1",
  tripId: TRIP.id,
  type: "sehenswuerdigkeit",
  title: "Ausgrabungsstätte Pompeji",
  shortText: "",
  longText: "",
  startAt: `${ANREISETAG}T10:00`,
  endAt: `${ANREISETAG}T12:30`,
  poiId: POMPEJI.id,
};

const OHNE_POI: Activity = {
  id: "activity-2",
  tripId: TRIP.id,
  type: "restaurant",
  title: "Abendessen im Hotel",
  shortText: "",
  longText: "",
  startAt: `${ANREISETAG}T19:00`,
  endAt: `${ANREISETAG}T20:30`,
};

/**
 * Die Schnittstelle, wie der Route-Handler sie beantwortet (siehe
 * app/api/programmpunkte/route.ts): angelegt wird, was die Domaenenlogik aus
 * POI, Reise und Startzeit ergibt.
 */
function mockServer(pois: Poi[]) {
  const anfragen: { method: string; body: Record<string, unknown> }[] = [];
  const angelegt: Activity[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      anfragen.push({ method: String(init.method), body });

      if (init.method === "DELETE") {
        const activity = angelegt.find((a) => a.id === body.id);
        return Response.json(
          activity ? { activity } : { error: "unknown activity" },
          { status: activity ? 200 : 404 },
        );
      }

      const gefunden = pois.find((p) => p.id === body.poiId);
      const values = gefunden
        ? plannedActivityFromPoi(gefunden, TRIP, String(body.startAt))
        : null;
      if (!values) {
        return Response.json({ error: "invalid body" }, { status: 400 });
      }
      const activity: Activity = {
        ...values,
        id: `activity-${angelegt.length + 1}`,
        poiId: values.poiId ?? undefined,
      };
      angelegt.push(activity);
      return Response.json({ activity }, { status: 201 });
    }),
  );

  return { anfragen };
}

/**
 * Die Planungsansicht mitsamt der Liste der Programmpunkte, die sonst in
 * PlanView liegt.
 */
function Planung({
  pois,
  activities = [],
  plannable = true,
}: {
  pois: Poi[];
  activities?: Activity[];
  plannable?: boolean;
}) {
  const [current, setCurrent] = useState(activities);
  return (
    <PlanungView
      trip={TRIP}
      pois={pois}
      activities={current}
      transfers={[]}
      today={TODAY}
      onActivityPlanned={
        plannable
          ? (activity) => setCurrent((liste) => [...liste, activity])
          : undefined
      }
      onActivityRemoved={
        plannable
          ? (activity) =>
              setCurrent((liste) => liste.filter((a) => a.id !== activity.id))
          : undefined
      }
    />
  );
}

/**
 * Zieht einen POI auf den Zeitstrahl. `offsetPx` misst ab der Oberkante des
 * Rasters; in jsdom liegt diese bei 0, weshalb clientY dem Abstand
 * entspricht. jsdom kennt kein DragEvent -- der Zug wird deshalb als
 * MouseEvent losgeschickt, das React derselben Behandlung zufuehrt.
 */
function ziehenAuf(poiId: string, offsetPx: number) {
  fireEvent.dragStart(screen.getByTestId(`unplanned-poi-${poiId}`));
  fireEvent(
    screen.getByTestId("timeline-grid"),
    new MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      clientY: offsetPx,
    }),
  );
}

/** Der Abstand einer Uhrzeit von der Rasteroberkante; das Raster beginnt um 08:00. */
function offsetFuer(hours: number, minutes = 0): number {
  return (hours - 8) * HOUR_HEIGHT_PX + (minutes / 60) * HOUR_HEIGHT_PX;
}

function unverplant() {
  return screen.getByRole("heading", { name: "Noch unverplant" })
    .parentElement as HTMLElement;
}

beforeEach(() => {
  mockServer([POMPEJI, VILLA_RUFOLO]);
});

describe("POI auf den Zeitstrahl ziehen (req-039)", () => {
  it("legt an der Stelle des Loslassens einen Programmpunkt an", async () => {
    render(<Planung pois={[POMPEJI]} />);

    ziehenAuf(POMPEJI.id, offsetFuer(10));

    const block = await screen.findByTestId("activity-block-activity-1");
    expect(block).toHaveTextContent("Ausgrabungsstätte Pompeji");
  });

  it("gibt dem Programmpunkt die geschaetzte Dauer des POI-Typs", async () => {
    render(<Planung pois={[POMPEJI]} />);

    ziehenAuf(POMPEJI.id, offsetFuer(10));

    // Sehenswuerdigkeit: 2,5 h (req-011, GUI).
    const block = await screen.findByTestId("activity-block-activity-1");
    expect(block).toHaveTextContent("10:00 – 12:30");
  });

  it("rastet ein Loslassen zwischen 10:00 und 10:15 auf 10:00 ein", async () => {
    const { anfragen } = mockServer([POMPEJI]);
    render(<Planung pois={[POMPEJI]} />);

    ziehenAuf(POMPEJI.id, offsetFuer(10, 11));

    await screen.findByTestId("activity-block-activity-1");
    expect(anfragen[0]).toMatchObject({
      method: "POST",
      body: { poiId: POMPEJI.id, startAt: `${ANREISETAG}T10:00` },
    });
  });

  it('nimmt den verplanten POI aus "Noch unverplant"', async () => {
    render(<Planung pois={[POMPEJI, VILLA_RUFOLO]} />);
    expect(within(unverplant()).getByText("Villa Rufolo")).toBeInTheDocument();

    ziehenAuf(VILLA_RUFOLO.id, offsetFuer(10));

    await waitFor(() =>
      expect(
        within(unverplant()).queryByText("Villa Rufolo"),
      ).not.toBeInTheDocument(),
    );
    // Der zweite POI bleibt stehen -- verplant ist nur der gezogene.
    expect(
      within(unverplant()).getByText("Ausgrabungsstätte Pompeji"),
    ).toBeInTheDocument();
  });

  it("laesst den Status des verplanten POI unveraendert", async () => {
    const { anfragen } = mockServer([VILLA_RUFOLO]);
    render(<Planung pois={[VILLA_RUFOLO]} />);

    ziehenAuf(VILLA_RUFOLO.id, offsetFuer(10));

    await screen.findByTestId("activity-block-activity-1");
    // Verplant und bewertet sind zwei verschiedene Dinge: der Status wird
    // gar nicht erst mitgeschickt.
    expect(anfragen).toHaveLength(1);
    expect(anfragen[0].body).not.toHaveProperty("status");
  });

  it("macht aus einem POI vom Typ Strand einen Programmpunkt Sehenswürdigkeit", async () => {
    const strand = poi("poi-strand", "Spiaggia Grande", "strand");
    mockServer([strand]);
    render(<Planung pois={[strand]} />);

    ziehenAuf(strand.id, offsetFuer(10));

    const block = await screen.findByTestId("activity-block-activity-1");
    expect(block).toHaveTextContent("Sehenswürdigkeit");
  });

  it("stellt einen ueberlappenden Programmpunkt daneben", async () => {
    render(<Planung pois={[POMPEJI, VILLA_RUFOLO]} />);

    ziehenAuf(POMPEJI.id, offsetFuer(10));
    await screen.findByTestId("activity-block-activity-1");
    ziehenAuf(VILLA_RUFOLO.id, offsetFuer(11));
    await screen.findByTestId("activity-block-activity-2");

    const erster = screen.getByTestId("activity-block-activity-1");
    const zweiter = screen.getByTestId("activity-block-activity-2");
    expect(erster.style.left).toBe("0%");
    expect(erster.style.width).toBe("calc(50% - 4px)");
    expect(zweiter.style.left).toBe("50%");
    expect(zweiter.style.width).toBe("calc(50% - 4px)");
  });

  it("bietet Ziehen und Entfernen nicht an, wenn die Ansicht nur anzeigt (req-038)", () => {
    render(
      <Planung
        pois={[VILLA_RUFOLO]}
        activities={[OHNE_POI]}
        plannable={false}
      />,
    );

    expect(
      screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`),
    ).not.toHaveAttribute("draggable", "true");
    expect(screen.queryAllByTestId(/^remove-activity-/)).toHaveLength(0);
  });
});

describe("Programmpunkt entfernen (req-039)", () => {
  function antwortMit(activity: Activity) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ activity })),
    );
  }

  it('stellt den POI danach wieder unter "Noch unverplant"', async () => {
    antwortMit(AUS_POI);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    expect(
      within(unverplant()).queryByText("Ausgrabungsstätte Pompeji"),
    ).not.toBeInTheDocument();

    const entfernen = screen.getByTestId("remove-activity-activity-1");
    expect(entfernen).toHaveAccessibleName(
      "Programmpunkt „Ausgrabungsstätte Pompeji“ entfernen",
    );
    fireEvent.click(entfernen);

    await waitFor(() =>
      expect(
        within(unverplant()).getByText("Ausgrabungsstätte Pompeji"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("activity-block-activity-1"),
    ).not.toBeInTheDocument();
  });

  it("laesst die Spalte unberuehrt, wenn er aus keinem POI stammt", async () => {
    antwortMit(OHNE_POI);
    render(<Planung pois={[]} activities={[OHNE_POI]} />);

    fireEvent.click(screen.getByTestId("remove-activity-activity-2"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("activity-block-activity-2"),
      ).not.toBeInTheDocument(),
    );
    expect(within(unverplant()).queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("Planungsansicht ohne Inhalt (req-039)", () => {
  it("zeigt einen Reisetag ohne Programmpunkte als leeres Raster, ohne Fehlermeldung", () => {
    render(<Planung pois={[POMPEJI]} />);

    const grid = screen.getByTestId("timeline-grid");
    expect(within(grid).getByText("08:00")).toBeInTheDocument();
    expect(within(grid).getByText("22:00")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it('zeigt ohne unverplante POIs eine leere Spalte "Noch unverplant"', () => {
    render(<Planung pois={[]} />);

    expect(within(unverplant()).queryAllByRole("listitem")).toHaveLength(0);
  });
});
