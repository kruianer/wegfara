import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MapLibreMap } from "@/tests/mocks/maplibre-gl";
import { PlanungView } from "./planung-view";
import type { Trip } from "@/lib/trips/types";
import type { Poi, PoiStatus, PoiType } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import { HOUR_HEIGHT_PX } from "@/lib/plan/timeline-grid";
import {
  ZOOM_MAX_PX,
  ZOOM_STUFEN_PX,
  groessereStundenhoehePx,
  kleinereStundenhoehePx,
} from "@/lib/plan/timeline-zoom";
import { plannedActivityFromPoi } from "@/lib/plan/plan-poi";
import {
  movedActivityTimes,
  resizedActivityStartTimes,
  resizedActivityTimes,
} from "@/lib/plan/move-activity";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

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
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
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
 * app/api/programmpunkte/route.ts): angelegt und umgeplant wird, was die
 * Domaenenlogik aus POI, Reise und Zeitangabe ergibt.
 */
function mockServer(pois: Poi[], vorhandene: Activity[] = []) {
  const anfragen: { method: string; body: Record<string, unknown> }[] = [];
  const angelegt: Activity[] = [...vorhandene];

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

      if (init.method === "PATCH") {
        const index = angelegt.findIndex((a) => a.id === body.id);
        if (index < 0) {
          return Response.json({ error: "unknown activity" }, { status: 404 });
        }
        const times = body.endAt
          ? resizedActivityTimes(angelegt[index], String(body.endAt))
          : body.edge === "start"
            ? resizedActivityStartTimes(angelegt[index], String(body.startAt))
            : movedActivityTimes(angelegt[index], TRIP, String(body.startAt));
        if (!times) {
          return Response.json({ error: "invalid body" }, { status: 400 });
        }
        angelegt[index] = { ...angelegt[index], ...times };
        return Response.json({ activity: angelegt[index] });
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
      onActivityRescheduled={
        plannable
          ? (activity) =>
              setCurrent((liste) =>
                liste.map((a) => (a.id === activity.id ? activity : a)),
              )
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
function aufRasterLoslassen(offsetPx: number) {
  fireEvent(
    screen.getByTestId("timeline-grid"),
    new MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      clientY: offsetPx,
    }),
  );
}

function ziehenAuf(poiId: string, offsetPx: number) {
  fireEvent.dragStart(screen.getByTestId(`unplanned-poi-${poiId}`));
  aufRasterLoslassen(offsetPx);
}

/** Zieht einen Programmpunkt auf eine andere Stelle des Rasters (req-040). */
function programmpunktZiehenAuf(activityId: string, offsetPx: number) {
  fireEvent.dragStart(screen.getByTestId(`activity-block-${activityId}`));
  aufRasterLoslassen(offsetPx);
}

/** Zieht die untere Kante eines Programmpunkts auf eine Stelle des Rasters (req-040). */
function randZiehenAuf(activityId: string, offsetPx: number) {
  fireEvent.dragStart(screen.getByTestId(`resize-activity-${activityId}`));
  aufRasterLoslassen(offsetPx);
}

/** Zieht die obere Kante eines Programmpunkts auf eine Stelle des Rasters (req-046). */
function obereKanteZiehenAuf(activityId: string, offsetPx: number) {
  fireEvent.dragStart(
    screen.getByTestId(`resize-activity-start-${activityId}`),
  );
  aufRasterLoslassen(offsetPx);
}

/**
 * Fuehrt den Zeiger ueber das Raster, ohne loszulassen -- daraus entsteht der
 * Umriss (req-046). jsdom kennt kein DragEvent; wie beim Loslassen tut es ein
 * MouseEvent, das React derselben Behandlung zufuehrt.
 */
function ueberRasterZiehen(offsetPx: number) {
  fireEvent(
    screen.getByTestId("timeline-grid"),
    new MouseEvent("dragover", {
      bubbles: true,
      cancelable: true,
      clientY: offsetPx,
    }),
  );
}

/**
 * Fuehrt den Zeiger vom Raster weg -- auf `nach`, das innerhalb des Rasters
 * liegen kann (ein Programmpunkt) oder ausserhalb. Wie beim Loslassen tut es
 * ein MouseEvent: nur dessen `relatedTarget` sagt, wohin der Zeiger gewandert
 * ist.
 */
function vomRasterWeg(nach: Element) {
  fireEvent(
    screen.getByTestId("timeline-grid"),
    new MouseEvent("dragleave", {
      bubbles: true,
      cancelable: true,
      relatedTarget: nach,
    }),
  );
}

/** Der Umriss, der zeigt, wo eingerastet wird -- null, wenn keiner liegt. */
function umriss() {
  return screen.queryByTestId("drag-preview");
}

/** Zieht einen Programmpunkt auf den Reiter eines anderen Reisetages (req-040). */
function aufReiterZiehen(activityId: string, date: string) {
  fireEvent.dragStart(screen.getByTestId(`activity-block-${activityId}`));
  fireEvent.drop(screen.getByTestId(`day-tab-${date}`));
}

/**
 * Was gerade unter dem Finger liegt. jsdom kennt `document.elementFromPoint`
 * nicht -- die Ablageflaeche wird deshalb gesetzt statt aus der Geometrie
 * ermittelt (siehe pointer-drag.ts).
 */
let unterDemFinger: Element | null = null;

/**
 * Zieht mit dem Finger (bug-017): Zeiger-Ereignisse statt des nativen Zuges,
 * den Safari auf dem iPad nicht startet. Die Oberkante des Rasters liegt in
 * jsdom bei 0, weshalb clientY dem Abstand entspricht -- wie beim Zug mit der
 * Maus.
 */
function mitFingerZiehen(
  quelle: HTMLElement,
  ziel: HTMLElement,
  y: number,
  pointerType = "touch",
) {
  const zeiger = mitFingerHalten(quelle, ziel, y, pointerType);
  fireEvent.pointerUp(quelle, { ...zeiger, clientY: y });
}

/**
 * Derselbe Zug, aber der Finger bleibt liegen -- so ist der Umriss zu sehen
 * (req-046). Liefert den Zeiger, mit dem sich danach loslassen laesst.
 */
function mitFingerHalten(
  quelle: HTMLElement,
  ziel: HTMLElement,
  y: number,
  pointerType = "touch",
) {
  unterDemFinger = ziel;
  const zeiger = { pointerId: 4, pointerType, clientX: 30, clientY: 0 };
  fireEvent.pointerDown(quelle, zeiger);
  fireEvent.pointerMove(quelle, { ...zeiger, clientY: y });
  return zeiger;
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
  unterDemFinger = null;
  document.elementFromPoint = () => unterDemFinger;
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
    // Und umplanen laesst sich ebenso wenig etwas (req-040).
    expect(
      screen.getByTestId(`activity-block-${OHNE_POI.id}`),
    ).not.toHaveAttribute("draggable", "true");
    expect(screen.queryAllByTestId(/^resize-activity-/)).toHaveLength(0);
  });
});

describe("Programmpunkt umplanen (req-040)", () => {
  it("zieht ihn auf eine andere Uhrzeit und behaelt seine Dauer", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
      "10:00 – 12:30",
    );

    programmpunktZiehenAuf(AUS_POI.id, offsetFuer(14));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "14:00 – 16:30",
      ),
    );
  });

  it("rastet die neue Startzeit auf 15 Minuten ein", async () => {
    const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    programmpunktZiehenAuf(AUS_POI.id, offsetFuer(14, 11));

    await waitFor(() => expect(anfragen).toHaveLength(1));
    expect(anfragen[0]).toMatchObject({
      method: "PATCH",
      body: { id: AUS_POI.id, startAt: `${ANREISETAG}T14:00` },
    });
  });

  it("nimmt ihn auf den Reiter eines anderen Reisetages mit", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    aufReiterZiehen(AUS_POI.id, "2026-07-19");

    // Vom Anreisetag ist er verschwunden ...
    await waitFor(() =>
      expect(
        screen.queryByTestId("activity-block-activity-1"),
      ).not.toBeInTheDocument(),
    );
    // ... und liegt am Folgetag zur selben Uhrzeit.
    fireEvent.click(screen.getByTestId("day-tab-2026-07-19"));
    expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
      "10:00 – 12:30",
    );
  });

  it("zieht den unteren Rand auf ein neues Ende", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    randZiehenAuf(AUS_POI.id, offsetFuer(14));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "10:00 – 14:00",
      ),
    );
  });

  it("laesst ihn nicht kuerzer als 15 Minuten werden", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    // Ueber den Beginn hinaus nach oben gezogen.
    randZiehenAuf(AUS_POI.id, offsetFuer(9));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "10:00 – 10:15",
      ),
    );
  });

  it('laesst den POI eines verschobenen Programmpunkts aus "Noch unverplant" heraus', async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    programmpunktZiehenAuf(AUS_POI.id, offsetFuer(14));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "14:00 – 16:30",
      ),
    );
    expect(
      within(unverplant()).queryByText("Ausgrabungsstätte Pompeji"),
    ).not.toBeInTheDocument();
  });

  it("stellt ihn neben einen bereits dort liegenden Programmpunkt, statt abzulehnen", async () => {
    mockServer([], [AUS_POI, OHNE_POI]);
    render(<Planung pois={[]} activities={[AUS_POI, OHNE_POI]} />);

    // AUS_POI liegt von 10:00 bis 12:30 -- der zweite wird mittenhinein gezogen.
    programmpunktZiehenAuf(OHNE_POI.id, offsetFuer(11));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-2")).toHaveTextContent(
        "11:00 – 12:30",
      ),
    );
    const erster = screen.getByTestId("activity-block-activity-1");
    const zweiter = screen.getByTestId("activity-block-activity-2");
    expect(erster.style.left).toBe("0%");
    expect(zweiter.style.left).toBe("50%");
  });

  it("verschiebt nichts, wenn die Schnittstelle ablehnt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "invalid body" }, { status: 400 }),
      ),
    );
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    programmpunktZiehenAuf(AUS_POI.id, offsetFuer(14));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
      "10:00 – 12:30",
    );
  });
});

describe("Vorschau beim Ziehen (req-046)", () => {
  it("zeigt beim Ziehen eines POI einen Umriss mit der Uhrzeit", () => {
    render(<Planung pois={[VILLA_RUFOLO]} />);

    fireEvent.dragStart(screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`));
    ueberRasterZiehen(offsetFuer(14));

    const vorschau = umriss();
    expect(vorschau).toHaveTextContent("14:00");
    expect(vorschau?.style.top).toBe(`${offsetFuer(14)}px`);
    // In seiner Hoehe: Sehenswuerdigkeit sind 2,5 h (req-011, GUI).
    expect(vorschau?.style.height).toBe(`${2.5 * HOUR_HEIGHT_PX}px`);
  });

  it("laesst den Umriss zwischen 14:00 und 14:15 auf 14:00 stehen", () => {
    render(<Planung pois={[VILLA_RUFOLO]} />);
    fireEvent.dragStart(screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`));

    ueberRasterZiehen(offsetFuer(14));
    expect(umriss()).toHaveTextContent("14:00");
    ueberRasterZiehen(offsetFuer(14, 11));

    expect(umriss()).toHaveTextContent("14:00");
    expect(umriss()?.style.top).toBe(`${offsetFuer(14)}px`);
  });

  it("zeigt keinen Umriss, solange nichts gezogen wird", () => {
    render(<Planung pois={[VILLA_RUFOLO]} activities={[AUS_POI]} />);

    ueberRasterZiehen(offsetFuer(14));

    expect(umriss()).not.toBeInTheDocument();
  });

  it("laesst den Umriss stehen, wenn der Zeiger ueber einen liegenden Programmpunkt faehrt", () => {
    mockServer([VILLA_RUFOLO], [AUS_POI]);
    render(<Planung pois={[VILLA_RUFOLO]} activities={[AUS_POI]} />);

    fireEvent.dragStart(screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`));
    ueberRasterZiehen(offsetFuer(11));
    // Der Programmpunkt liegt von 10:00 bis 12:30: das Raster meldet ein
    // Verlassen an eines seiner Kinder, nicht nach draussen.
    vomRasterWeg(screen.getByTestId(`activity-block-${AUS_POI.id}`));

    expect(umriss()).toHaveTextContent("11:00");
  });

  it("nimmt den Umriss weg, wenn der Zeiger das Raster verlaesst", () => {
    render(<Planung pois={[VILLA_RUFOLO]} />);

    fireEvent.dragStart(screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`));
    ueberRasterZiehen(offsetFuer(14));
    expect(umriss()).toBeInTheDocument();
    vomRasterWeg(unverplant());

    expect(umriss()).not.toBeInTheDocument();
  });

  it("zeigt beim Ziehen eines liegenden Programmpunkts einen Umriss mit der Uhrzeit", () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    fireEvent.dragStart(screen.getByTestId(`activity-block-${AUS_POI.id}`));
    ueberRasterZiehen(offsetFuer(16));

    const vorschau = umriss();
    expect(vorschau).toHaveTextContent("16:00");
    expect(vorschau?.style.top).toBe(`${offsetFuer(16)}px`);
    // Er behaelt beim Verschieben seine Dauer von 2,5 Stunden.
    expect(vorschau?.style.height).toBe(`${2.5 * HOUR_HEIGHT_PX}px`);
  });

  it("nimmt den Umriss nach dem Loslassen wieder weg", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    fireEvent.dragStart(screen.getByTestId(`activity-block-${AUS_POI.id}`));
    ueberRasterZiehen(offsetFuer(16));
    expect(umriss()).toBeInTheDocument();
    aufRasterLoslassen(offsetFuer(16));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "16:00 – 18:30",
      ),
    );
    expect(umriss()).not.toBeInTheDocument();
  });

  it("nimmt den Umriss auch weg, wenn der Zug ohne Ablegen endet", () => {
    render(<Planung pois={[VILLA_RUFOLO]} />);
    const karte = screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`);

    fireEvent.dragStart(karte);
    ueberRasterZiehen(offsetFuer(14));
    expect(umriss()).toBeInTheDocument();
    fireEvent.dragEnd(karte);

    expect(umriss()).not.toBeInTheDocument();
  });

  it("zeigt beim Ziehen der oberen Kante den neuen Beginn", () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    fireEvent.dragStart(
      screen.getByTestId(`resize-activity-start-${AUS_POI.id}`),
    );
    ueberRasterZiehen(offsetFuer(9));

    const vorschau = umriss();
    expect(vorschau).toHaveTextContent("09:00");
    // 09:00 bis 12:30 -- das Ende steht, die Dauer waechst.
    expect(vorschau?.style.top).toBe(`${offsetFuer(9)}px`);
    expect(vorschau?.style.height).toBe(`${3.5 * HOUR_HEIGHT_PX}px`);
  });

  it("zeigt beim Ziehen der unteren Kante das neue Ende", () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    fireEvent.dragStart(screen.getByTestId(`resize-activity-${AUS_POI.id}`));
    ueberRasterZiehen(offsetFuer(14));

    expect(umriss()).toHaveTextContent("14:00");
    expect(umriss()?.style.top).toBe(`${offsetFuer(10)}px`);
  });

  it("zeigt den Umriss auch beim Ziehen mit dem Finger", () => {
    render(<Planung pois={[VILLA_RUFOLO]} />);
    const karte = screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`);

    const zeiger = mitFingerHalten(
      karte,
      screen.getByTestId("timeline-grid"),
      offsetFuer(14),
    );
    expect(umriss()).toHaveTextContent("14:00");

    fireEvent.pointerUp(karte, { ...zeiger, clientY: offsetFuer(14) });
    expect(umriss()).not.toBeInTheDocument();
  });

  it("zeigt keinen Umriss, wenn der Finger neben dem Raster steht", () => {
    render(<Planung pois={[VILLA_RUFOLO]} />);

    mitFingerHalten(
      screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`),
      unverplant(),
      offsetFuer(14),
    );

    expect(umriss()).not.toBeInTheDocument();
  });

  it("zeigt keinen Umriss, wenn die Ansicht nur anzeigt (req-038)", () => {
    render(
      <Planung
        pois={[VILLA_RUFOLO]}
        activities={[OHNE_POI]}
        plannable={false}
      />,
    );

    ueberRasterZiehen(offsetFuer(14));

    expect(umriss()).not.toBeInTheDocument();
  });
});

describe("Kanten des Programmpunkts ziehen (req-046)", () => {
  it("zieht die obere Kante auf einen neuen Beginn und laesst das Ende stehen", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    obereKanteZiehenAuf(AUS_POI.id, offsetFuer(9));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "09:00 – 12:30",
      ),
    );
  });

  it("laesst ihn nicht kuerzer als 15 Minuten werden", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    // Ueber das Ende hinaus nach unten gezogen.
    obereKanteZiehenAuf(AUS_POI.id, offsetFuer(14));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "12:15 – 12:30",
      ),
    );
  });

  it("laesst beim Ziehen der unteren Kante den Beginn stehen", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    randZiehenAuf(AUS_POI.id, offsetFuer(14));

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "10:00 – 14:00",
      ),
    );
  });

  it("schickt die obere Kante als solche an die Schnittstelle -- nicht als Verschieben", async () => {
    const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    obereKanteZiehenAuf(AUS_POI.id, offsetFuer(9, 11));

    await waitFor(() => expect(anfragen).toHaveLength(1));
    // Und rastet dabei auf 15 Minuten ein.
    expect(anfragen[0]).toMatchObject({
      method: "PATCH",
      body: { id: AUS_POI.id, startAt: `${ANREISETAG}T09:00`, edge: "start" },
    });
  });

  it("zieht die obere Kante auch mit dem Finger (bug-017)", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    mitFingerZiehen(
      screen.getByTestId(`resize-activity-start-${AUS_POI.id}`),
      screen.getByTestId("timeline-grid"),
      offsetFuer(9),
    );

    // Der Block zieht nicht als Ganzes mit: das Ende bleibt, wo es war.
    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "09:00 – 12:30",
      ),
    );
  });

  it("laesst das Kreuz zum Entfernen erreichbar, obwohl die obere Kante dort liegt", () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    const kante = screen.getByTestId(`resize-activity-start-${AUS_POI.id}`);
    const kreuz = screen.getByTestId(`remove-activity-${AUS_POI.id}`);

    // Beide liegen am oberen Rand des Blocks. Das Kreuz kommt spaeter und
    // deckt die Kante an seiner Stelle ab -- sonst waere das Entfernen aus
    // req-039 nicht mehr zu treffen.
    expect(
      kante.compareDocumentPosition(kreuz) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("bietet die obere Kante nicht an, wenn die Ansicht nur anzeigt (req-038)", () => {
    render(
      <Planung
        pois={[VILLA_RUFOLO]}
        activities={[OHNE_POI]}
        plannable={false}
      />,
    );

    expect(screen.queryAllByTestId(/^resize-activity-start-/)).toHaveLength(0);
  });
});

describe("Anfasser am Programmpunkt (bug-022)", () => {
  /** Die Rahmenfarbe des Blocks -- an ihr zeigt sich die gegriffene Kante. */
  function rahmenfarbe(activityId: string) {
    return screen.getByTestId(`activity-block-${activityId}`).style.borderColor;
  }

  /** Die Farbe der gegriffenen Kante (siehe timeline-column.tsx). */
  const GEGRIFFEN = "var(--acc)";

  function obereKante() {
    return screen.getByTestId(`resize-activity-start-${AUS_POI.id}`);
  }

  function untereKante() {
    return screen.getByTestId(`resize-activity-${AUS_POI.id}`);
  }

  beforeEach(() => {
    mockServer([POMPEJI], [AUS_POI]);
  });

  it("zeigt an der oberen und der unteren Kante einen sichtbaren Anfasser", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    // Sichtbar heisst: ein eigenes Element in der Kante, nicht nur eine
    // unsichtbare Greifflaeche.
    expect(obereKante()).toContainElement(
      screen.getByTestId(`resize-grip-start-${AUS_POI.id}`),
    );
    expect(untereKante()).toContainElement(
      screen.getByTestId(`resize-grip-end-${AUS_POI.id}`),
    );
  });

  it("faerbt den Rahmen um, sobald der Finger auf der oberen Kante liegt", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const vorher = rahmenfarbe(AUS_POI.id);
    expect(vorher).not.toBe(GEGRIFFEN);

    // Der Finger liegt auf der Kante -- gezogen wird noch nicht.
    fireEvent.pointerEnter(obereKante());
    fireEvent.pointerDown(obereKante(), {
      pointerId: 4,
      pointerType: "touch",
      clientX: 30,
      clientY: 0,
    });

    expect(rahmenfarbe(AUS_POI.id)).toBe(GEGRIFFEN);
  });

  it("faerbt den Rahmen ebenso um, wenn die untere Kante gegriffen wird", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    fireEvent.pointerEnter(untereKante());

    expect(rahmenfarbe(AUS_POI.id)).toBe(GEGRIFFEN);
  });

  it("hebt den gegriffenen Anfasser hervor, den der anderen Kante nicht", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const oben = screen.getByTestId(`resize-grip-start-${AUS_POI.id}`);
    const unten = screen.getByTestId(`resize-grip-end-${AUS_POI.id}`);
    const ungegriffen = oben.className;

    fireEvent.pointerEnter(obereKante());

    expect(oben.className).not.toBe(ungegriffen);
    expect(unten.className).toBe(ungegriffen);
  });

  it("gibt dem Rahmen seine Typfarbe zurueck, wenn der Zeiger die Kante verlaesst", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const typfarbe = rahmenfarbe(AUS_POI.id);

    fireEvent.pointerEnter(obereKante());
    fireEvent.pointerLeave(obereKante());

    expect(rahmenfarbe(AUS_POI.id)).toBe(typfarbe);
  });

  it("gibt ihn auch zurueck, wenn der Finger nach dem Ziehen loslaesst", async () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const typfarbe = rahmenfarbe(AUS_POI.id);

    mitFingerZiehen(obereKante(), screen.getByTestId("timeline-grid"), 9);

    await waitFor(() => expect(rahmenfarbe(AUS_POI.id)).toBe(typfarbe));
  });

  it("faerbt den Rahmen nicht um, wenn der Block selbst angefasst wird", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const typfarbe = rahmenfarbe(AUS_POI.id);

    // Der ganze Programmpunkt wird verschoben -- keine Kante gegriffen.
    fireEvent.pointerEnter(screen.getByTestId(`activity-block-${AUS_POI.id}`));

    expect(rahmenfarbe(AUS_POI.id)).toBe(typfarbe);
  });
});

describe("Ziehen mit dem Finger (bug-017)", () => {
  function raster() {
    return screen.getByTestId("timeline-grid");
  }

  it("verplant einen mit dem Finger gezogenen POI auf dem Zeitstrahl", async () => {
    render(<Planung pois={[POMPEJI]} />);

    mitFingerZiehen(
      screen.getByTestId(`unplanned-poi-${POMPEJI.id}`),
      raster(),
      offsetFuer(10),
    );

    const block = await screen.findByTestId("activity-block-activity-1");
    expect(block).toHaveTextContent("Ausgrabungsstätte Pompeji");
    expect(block).toHaveTextContent("10:00 – 12:30");
    await waitFor(() =>
      expect(
        within(unverplant()).queryByText("Ausgrabungsstätte Pompeji"),
      ).not.toBeInTheDocument(),
    );
  });

  it("zieht einen Programmpunkt mit dem Finger auf eine andere Uhrzeit", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    mitFingerZiehen(
      screen.getByTestId(`activity-block-${AUS_POI.id}`),
      raster(),
      offsetFuer(14),
    );

    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "14:00 – 16:30",
      ),
    );
  });

  it("nimmt ihn mit dem Finger auf den Reiter eines anderen Reisetages mit", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    mitFingerZiehen(
      screen.getByTestId(`activity-block-${AUS_POI.id}`),
      screen.getByTestId("day-tab-2026-07-19"),
      offsetFuer(9),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("activity-block-activity-1"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("day-tab-2026-07-19"));
    expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
      "10:00 – 12:30",
    );
  });

  it("zieht den unteren Rand mit dem Finger auf ein neues Ende", async () => {
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    mitFingerZiehen(
      screen.getByTestId(`resize-activity-${AUS_POI.id}`),
      raster(),
      offsetFuer(14),
    );

    // Der Block darunter zieht nicht mit: der Beginn bleibt, wo er war.
    await waitFor(() =>
      expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
        "10:00 – 14:00",
      ),
    );
  });

  it("verplant nichts, wenn der Finger nur tippt", () => {
    render(<Planung pois={[POMPEJI]} />);

    const zeiger = {
      pointerId: 4,
      pointerType: "touch",
      clientX: 30,
      clientY: 0,
    };
    const karte = screen.getByTestId(`unplanned-poi-${POMPEJI.id}`);
    unterDemFinger = raster();
    fireEvent.pointerDown(karte, zeiger);
    fireEvent.pointerUp(karte, zeiger);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("verplant nichts, wenn der Browser den Zug abbricht", () => {
    render(<Planung pois={[POMPEJI]} />);

    const zeiger = {
      pointerId: 4,
      pointerType: "touch",
      clientX: 30,
      clientY: 0,
    };
    const karte = screen.getByTestId(`unplanned-poi-${POMPEJI.id}`);
    unterDemFinger = raster();
    fireEvent.pointerDown(karte, zeiger);
    fireEvent.pointerMove(karte, { ...zeiger, clientY: offsetFuer(10) });
    // Der Browser nimmt den Zug an sich, etwa um die Spalte zu rollen.
    fireEvent.pointerCancel(karte, { ...zeiger, clientY: offsetFuer(10) });
    fireEvent.pointerUp(karte, { ...zeiger, clientY: offsetFuer(10) });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("verplant nichts, wenn neben den Ablageflaechen losgelassen wird", () => {
    render(<Planung pois={[POMPEJI]} />);

    mitFingerZiehen(
      screen.getByTestId(`unplanned-poi-${POMPEJI.id}`),
      unverplant(),
      offsetFuer(10),
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it("laesst den Zug der Maus dem Browser", () => {
    render(<Planung pois={[POMPEJI]} />);

    // Sonst wertete ein Zug mit der Maus dasselbe Loslassen zweimal aus:
    // einmal nativ, einmal ueber die Zeiger-Ereignisse.
    mitFingerZiehen(
      screen.getByTestId(`unplanned-poi-${POMPEJI.id}`),
      raster(),
      offsetFuer(10),
      "mouse",
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it("bietet den Finger-Zug nicht an, wenn die Ansicht nur anzeigt (req-038)", () => {
    render(
      <Planung
        pois={[VILLA_RUFOLO]}
        activities={[OHNE_POI]}
        plannable={false}
      />,
    );

    mitFingerZiehen(
      screen.getByTestId(`unplanned-poi-${VILLA_RUFOLO.id}`),
      raster(),
      offsetFuer(10),
    );
    mitFingerZiehen(
      screen.getByTestId(`activity-block-${OHNE_POI.id}`),
      raster(),
      offsetFuer(14),
    );

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POI greifen und direkt auf die Uhrzeit ziehen (bug-023)", () => {
  /** Der Zeiger, mit dem der Finger auf der Karte aufsetzt. */
  const ZEIGER = {
    pointerId: 4,
    pointerType: "touch",
    clientX: 30,
    clientY: 0,
  };

  function karte() {
    return screen.getByTestId(`unplanned-poi-${POMPEJI.id}`);
  }

  function raster() {
    return screen.getByTestId("timeline-grid");
  }

  /**
   * Ob die Liste beim Ziehen noch rollen wuerde: gesperrt wird sie, indem der
   * Zug das `touchmove` abfaengt (siehe pointer-drag.ts).
   */
  function rolltNoch() {
    const bewegung = new Event("touchmove", {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(bewegung);
    return !bewegung.defaultPrevented;
  }

  /**
   * Laesst den Finger auf der Karte liegen, bis der POI gegriffen ist.
   * Liefert die Klassen der ungegriffenen Karte zum Vergleich.
   */
  async function greifen() {
    const ungegriffen = karte().className;
    fireEvent.pointerDown(karte(), ZEIGER);
    await waitFor(() => expect(karte().className).not.toBe(ungegriffen));
    return ungegriffen;
  }

  it("faerbt den Rahmen um, sobald der Finger auf dem POI liegen bleibt", async () => {
    render(<Planung pois={[POMPEJI]} />);
    const ungegriffen = karte().className;

    // Der Finger liegt nur auf der Karte -- bewegt wird noch nichts.
    fireEvent.pointerDown(karte(), ZEIGER);

    await waitFor(() => expect(karte().className).not.toBe(ungegriffen));
  });

  it("gibt den Rahmen wieder frei, wenn der Finger loslaesst", async () => {
    render(<Planung pois={[POMPEJI]} />);

    const ungegriffen = await greifen();
    fireEvent.pointerUp(karte(), ZEIGER);

    expect(karte().className).toBe(ungegriffen);
  });

  it("laesst die Liste rollen, solange der Finger nicht liegen geblieben ist", () => {
    render(<Planung pois={[POMPEJI]} />);

    fireEvent.pointerDown(karte(), ZEIGER);

    expect(rolltNoch()).toBe(true);
  });

  it("sperrt das Rollen, sobald der POI gegriffen ist", async () => {
    render(<Planung pois={[POMPEJI]} />);

    await greifen();

    // Ohne diese Sperre nimmt der Browser die Bewegung nach unten als Rollen
    // und bricht den Zug ab -- man muesste den POI erst zur Seite ziehen.
    expect(rolltNoch()).toBe(false);
  });

  it("gibt das Rollen mit dem Ende des Zuges wieder frei", async () => {
    render(<Planung pois={[POMPEJI]} />);

    await greifen();
    fireEvent.pointerUp(karte(), ZEIGER);

    expect(rolltNoch()).toBe(true);
  });

  it("verplant den gegriffenen POI in einem Zug direkt auf die Uhrzeit", async () => {
    const { anfragen } = mockServer([POMPEJI]);
    render(<Planung pois={[POMPEJI]} />);
    unterDemFinger = raster();

    await greifen();
    // Ein einziger Zug schraeg nach unten auf 14:00 -- ohne Zwischenschritt
    // ueber die Tagesansicht.
    fireEvent.pointerMove(karte(), {
      ...ZEIGER,
      clientX: 400,
      clientY: offsetFuer(14),
    });
    fireEvent.pointerUp(karte(), {
      ...ZEIGER,
      clientX: 400,
      clientY: offsetFuer(14),
    });

    const block = await screen.findByTestId("activity-block-activity-1");
    expect(block).toHaveTextContent("14:00 – 16:30");
    expect(anfragen[0]).toMatchObject({
      method: "POST",
      body: { poiId: POMPEJI.id, startAt: `${ANREISETAG}T14:00` },
    });
  });

  it("greift nichts, wenn die Ansicht nur anzeigt (req-038)", async () => {
    render(<Planung pois={[POMPEJI]} plannable={false} />);
    const ungegriffen = karte().className;

    fireEvent.pointerDown(karte(), ZEIGER);
    await new Promise((fertig) => setTimeout(fertig, 300));

    expect(karte().className).toBe(ungegriffen);
    expect(rolltNoch()).toBe(true);
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

/**
 * "KI planen lassen" (req-056): das Fenster, der Vorschlag im Zeitstrahl und
 * die Entscheidung darueber. Gespeichert wird erst beim Uebernehmen -- der
 * Server antwortet hier aus dem Haus.
 */
describe("KI planen lassen (req-056)", () => {
  /** Ein Vorschlag ueber genau einen Programmpunkt aus Pompeji. */
  const VORSCHLAG = {
    punkte: [
      {
        activityId: null,
        poiId: POMPEJI.id,
        type: "sehenswuerdigkeit",
        title: POMPEJI.name,
        shortText: "",
        longText: "",
        startAt: `${ANREISETAG}T08:00`,
        endAt: `${ANREISETAG}T10:30`,
        position: POMPEJI.position,
        unveraendert: false,
      },
    ],
    ohnePlatz: 0,
    engeStellen: [] as string[],
  };

  /** Der uebernommene Programmpunkt, wie ihn der Server zurueckgibt. */
  const UEBERNOMMEN: Activity = {
    id: "activity-neu",
    tripId: TRIP.id,
    type: "sehenswuerdigkeit",
    title: POMPEJI.name,
    shortText: "",
    longText: "",
    startAt: `${ANREISETAG}T08:00`,
    endAt: `${ANREISETAG}T10:30`,
    poiId: POMPEJI.id,
  };

  type Antwort = { vorschlag: unknown; grund?: string };

  function mockPlanung(
    antwort: Antwort = { vorschlag: VORSCHLAG },
    uebernahmeOk = true,
  ) {
    const anfragen: { method: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        anfragen.push({
          method: String(init.method),
          body: JSON.parse(String(init.body)) as Record<string, unknown>,
        });
        if (init.method === "PUT") {
          return uebernahmeOk
            ? Response.json({ activities: [UEBERNOMMEN], transfers: [] })
            : Response.json({ error: "fehler" }, { status: 500 });
        }
        return Response.json(antwort);
      }),
    );
    return anfragen;
  }

  /** Ein Lauf, der nie antwortet -- bis er abgebrochen wird. */
  function mockLaufenderLauf() {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
  }

  function KiPlanung({
    pois,
    activities = [],
    hasAiKey = true,
  }: {
    pois: Poi[];
    activities?: Activity[];
    hasAiKey?: boolean;
  }) {
    const [current, setCurrent] = useState(activities);
    return (
      <PlanungView
        trip={TRIP}
        pois={pois}
        activities={current}
        transfers={[]}
        today={TODAY}
        hasAiKey={hasAiKey}
        onActivityPlanned={(activity) =>
          setCurrent((liste) => [...liste, activity])
        }
        onActivityRemoved={(activity) =>
          setCurrent((liste) => liste.filter((a) => a.id !== activity.id))
        }
        onActivityRescheduled={(activity) =>
          setCurrent((liste) =>
            liste.map((a) => (a.id === activity.id ? activity : a)),
          )
        }
        onVorschlagUebernommen={(gespeicherte) =>
          setCurrent((liste) => [...liste, ...gespeicherte])
        }
      />
    );
  }

  const kiKnopf = () =>
    screen.getByRole("button", { name: "KI planen lassen" });

  /** Oeffnet das Fenster und laesst planen. */
  async function planenLassen(neuOrdnen = false) {
    fireEvent.click(kiKnopf());
    if (neuOrdnen) {
      fireEvent.click(screen.getByLabelText("Bestehendes neu ordnen"));
    }
    fireEvent.click(screen.getByRole("button", { name: "Planen lassen" }));
  }

  it("ist ohne hinterlegten Zugangsschluessel nicht ausloesbar und nennt den Grund", () => {
    render(<KiPlanung pois={[POMPEJI]} hasAiKey={false} />);

    expect(kiKnopf()).toBeDisabled();
    expect(screen.getByTestId("ki-kein-schluessel")).toHaveTextContent(
      "Zugangsschlüssel",
    );
  });

  it("oeffnet ein Fenster mit dem nicht vorausgewaehlten Haekchen und dem Hinweis auf die Abrechnung", () => {
    mockPlanung();
    render(<KiPlanung pois={[POMPEJI]} />);

    fireEvent.click(kiKnopf());

    expect(screen.getByLabelText("Bestehendes neu ordnen")).not.toBeChecked();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "über den Zugangsschlüssel des Accounts abgerechnet",
    );
  });

  it("zeigt den Vorschlag im Zeitstrahl, ohne ihn zu speichern", async () => {
    const anfragen = mockPlanung();
    render(<KiPlanung pois={[POMPEJI]} />);

    await planenLassen();

    await waitFor(() =>
      expect(screen.getByTestId("vorschlag-banner")).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId("activity-block-vorschlag-0"),
    ).toBeInTheDocument();
    // Gespeichert wird erst beim Uebernehmen (req-056).
    expect(anfragen.map((anfrage) => anfrage.method)).toEqual(["POST"]);
  });

  it("sendet das Haekchen „Bestehendes neu ordnen“ an den Server", async () => {
    const anfragen = mockPlanung();
    render(<KiPlanung pois={[POMPEJI]} activities={[AUS_POI]} />);

    await planenLassen(true);

    await waitFor(() => expect(anfragen).toHaveLength(1));
    expect(anfragen[0].body.neuOrdnen).toBe(true);
  });

  it("laesst den Plan unveraendert, wenn der Vorschlag verworfen wird", async () => {
    mockPlanung();
    render(<KiPlanung pois={[]} activities={[OHNE_POI]} />);

    await planenLassen();
    await waitFor(() =>
      expect(screen.getByTestId("vorschlag-banner")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));

    expect(screen.queryByTestId("vorschlag-banner")).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`activity-block-${OHNE_POI.id}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("activity-block-vorschlag-0"),
    ).not.toBeInTheDocument();
  });

  it("speichert den Vorschlag beim Uebernehmen und zeigt ihn danach als Plan", async () => {
    const anfragen = mockPlanung();
    render(<KiPlanung pois={[POMPEJI, VILLA_RUFOLO]} />);

    await planenLassen();
    await waitFor(() =>
      expect(screen.getByTestId("vorschlag-banner")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

    await waitFor(() =>
      expect(
        screen.getByTestId(`activity-block-${UEBERNOMMEN.id}`),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("vorschlag-banner")).not.toBeInTheDocument();
    expect(anfragen.map((anfrage) => anfrage.method)).toEqual(["POST", "PUT"]);
    expect(anfragen[1].body.punkte).toHaveLength(1);
    // Was keinen Platz fand, steht weiterhin in "Noch unverplant" (req-056).
    expect(
      within(unverplant()).getByText(VILLA_RUFOLO.name),
    ).toBeInTheDocument();
  });

  it("laesst den Vorschlag stehen und weist hin, wenn das Uebernehmen fehlschlaegt", async () => {
    mockPlanung({ vorschlag: VORSCHLAG }, false);
    render(<KiPlanung pois={[POMPEJI]} />);

    await planenLassen();
    await waitFor(() =>
      expect(screen.getByTestId("vorschlag-banner")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

    await waitFor(() =>
      expect(screen.getByTestId("vorschlag-fehler")).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId("activity-block-vorschlag-0"),
    ).toBeInTheDocument();
  });

  it("nennt die POIs, die keinen Platz fanden", async () => {
    mockPlanung({ vorschlag: { ...VORSCHLAG, ohnePlatz: 3 } });
    render(<KiPlanung pois={[POMPEJI, VILLA_RUFOLO]} />);

    await planenLassen();

    await waitFor(() =>
      expect(screen.getByTestId("vorschlag-ohne-platz")).toHaveTextContent(
        "3 POIs fanden keinen Platz",
      ),
    );
  });

  it("laesst die nicht verplanten POIs in „Noch unverplant“ stehen", async () => {
    mockPlanung();
    render(<KiPlanung pois={[POMPEJI, VILLA_RUFOLO]} />);

    await planenLassen();

    await waitFor(() =>
      expect(screen.getByTestId("vorschlag-banner")).toBeInTheDocument(),
    );
    expect(
      within(unverplant()).getByText(VILLA_RUFOLO.name),
    ).toBeInTheDocument();
    expect(
      within(unverplant()).queryByText(POMPEJI.name),
    ).not.toBeInTheDocument();
  });

  it("weist hin, wenn es nichts zu verplanen gibt", async () => {
    mockPlanung({ vorschlag: null, grund: "nichts_zu_verplanen" });
    render(<KiPlanung pois={[]} />);

    await planenLassen();

    await waitFor(() =>
      expect(screen.getByTestId("ki-nichts")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("vorschlag-banner")).not.toBeInTheDocument();
  });

  it("weist hin, wenn die Planung fehlschlaegt", async () => {
    mockPlanung({ vorschlag: null });
    render(<KiPlanung pois={[POMPEJI]} />);

    await planenLassen();

    await waitFor(() =>
      expect(screen.getByTestId("ki-fehler")).toBeInTheDocument(),
    );
  });

  it("laesst den Plan unveraendert, wenn der laufende Vorgang abgebrochen wird", async () => {
    mockLaufenderLauf();
    render(<KiPlanung pois={[POMPEJI]} activities={[OHNE_POI]} />);

    await planenLassen();
    await waitFor(() =>
      expect(screen.getByTestId("ki-fortschritt")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("vorschlag-banner")).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`activity-block-${OHNE_POI.id}`),
    ).toBeInTheDocument();
  });
});

/**
 * Die beiden rollenden Spalten der Planung tragen das gemeinsame Blatt der
 * Bildlaufleiste (bug-041) -- welche Farben es zieht, prueft
 * components/bildlauf.layout.test.ts.
 */
describe("Planung -- Bildlaufleisten der Spalten (bug-041)", () => {
  it("legt es auf den Zeitstrahl und auf „Noch unverplant“", () => {
    render(<Planung pois={[POMPEJI]} />);

    // Die rollende Flaeche ist jeweils das Elternelement des Rasters bzw.
    // der Listeneintraege.
    expect(
      screen.getByTestId("timeline-grid").parentElement?.className,
    ).toMatch(/bildlauf/);
    expect(
      screen.getByTestId(`unplanned-poi-${POMPEJI.id}`).parentElement
        ?.className,
    ).toMatch(/bildlauf/);
  });
});

/**
 * Die Nummer des POI in der Planung (req-074): dieselbe Zahl, die auf dem
 * Kartenmarker und in der POI-Liste steht -- in der Auswahlliste der noch
 * unverplanten POIs und am Programmpunkt des Zeitstrahls.
 */
describe("POI-Nummer in der Auswahlliste (req-074)", () => {
  /** POI 14 -- die Nummer, von der der Reiseleiter in Notizen spricht. */
  const NUMMER_14: Poi = { ...POMPEJI, number: 14 };

  it("zeigt die Nummer des POI in der Auswahlliste", () => {
    render(<Planung pois={[NUMMER_14]} />);

    expect(
      screen.getByTestId(`unplanned-poi-number-${NUMMER_14.id}`),
    ).toHaveTextContent("#14");
  });

  it("nimmt die Nummer aus dem POI und zaehlt nicht selbst", () => {
    // Die Reihenfolge in der Liste sagt nichts ueber die Nummer: sie steht am
    // POI (req-013) und bleibt ihm, wo er auch liegt.
    render(<Planung pois={[NUMMER_14, { ...VILLA_RUFOLO, number: 3 }]} />);

    expect(
      screen.getByTestId(`unplanned-poi-number-${NUMMER_14.id}`),
    ).toHaveTextContent("#14");
    expect(
      screen.getByTestId(`unplanned-poi-number-${VILLA_RUFOLO.id}`),
    ).toHaveTextContent("#3");
  });

  it("verdraengt den Namen des POI nicht", () => {
    render(<Planung pois={[NUMMER_14]} />);

    const karte = screen.getByTestId(`unplanned-poi-${NUMMER_14.id}`);
    expect(within(karte).getByText(NUMMER_14.name)).toBeInTheDocument();
    expect(within(karte).getByText("#14")).toBeInTheDocument();
  });
});

/**
 * Dieselbe Nummer am Programmpunkt des Zeitstrahls (req-074) -- bezogen ueber
 * `poiId`, nicht neu gezaehlt. Ein von Hand angelegter Programmpunkt traegt
 * keine und auch keinen Platzhalter an ihrer Stelle.
 */
describe("POI-Nummer am Programmpunkt (req-074)", () => {
  const NUMMER_14: Poi = { ...POMPEJI, number: 14 };

  it("zeigt die Nummer, sobald der POI in den Zeitstrahl gezogen ist", async () => {
    mockServer([NUMMER_14]);
    render(<Planung pois={[NUMMER_14]} />);

    ziehenAuf(NUMMER_14.id, offsetFuer(10));

    const block = await screen.findByTestId("activity-block-activity-1");
    expect(within(block).getByText("#14")).toBeInTheDocument();
    // Die Nummer verdraengt den Titel nicht.
    expect(within(block).getByText(NUMMER_14.name)).toBeInTheDocument();
  });

  it("zeigt sie auch an einem bereits verplanten Programmpunkt", () => {
    render(<Planung pois={[NUMMER_14]} activities={[AUS_POI]} />);

    expect(
      screen.getByTestId(`activity-number-${AUS_POI.id}`),
    ).toHaveTextContent("#14");
  });

  it("zeigt an einem von Hand angelegten Programmpunkt keine Nummer", () => {
    render(<Planung pois={[NUMMER_14]} activities={[AUS_POI, OHNE_POI]} />);

    expect(screen.queryByTestId(`activity-number-${OHNE_POI.id}`)).toBeNull();
    // Und keinen Platzhalter an ihrer Stelle: im Block steht der Titel, sonst
    // nichts, was nach einer Nummer aussieht.
    const block = screen.getByTestId(`activity-block-${OHNE_POI.id}`);
    expect(block).toHaveTextContent(OHNE_POI.title);
    expect(block.textContent).not.toContain("#");
  });

  it("erfindet keine Nummer, wenn der POI nicht mehr gefuehrt wird", () => {
    // Der Programmpunkt zeigt auf einen POI, den die Reise nicht fuehrt --
    // dann steht dort nichts, so wie ohne POI.
    render(<Planung pois={[VILLA_RUFOLO]} activities={[AUS_POI]} />);

    expect(screen.queryByTestId(`activity-number-${AUS_POI.id}`)).toBeNull();
  });
});

/**
 * Ein langer Titel verdraengt die Nummer nicht, und die Nummer verdraengt den
 * Titel nicht (req-074): beide stehen da, der Titel ganz.
 */
describe("POI-Nummer bei langem Titel (req-074)", () => {
  const LANGER_NAME =
    "Ausgrabungsstätte Pompeji mit Villa dei Misteri und dem großen Amphitheater";

  it("zeigt in der Auswahlliste Nummer und ganzen Namen", () => {
    const poi: Poi = { ...POMPEJI, number: 14, name: LANGER_NAME };
    render(<Planung pois={[poi]} />);

    const karte = screen.getByTestId(`unplanned-poi-${poi.id}`);
    expect(
      within(karte).getByTestId(`unplanned-poi-number-${poi.id}`),
    ).toHaveTextContent("#14");
    // Der Name steht ungekuerzt da -- nicht als "Ausgrabungsstätte Pompeji …".
    expect(within(karte).getByText(LANGER_NAME)).toBeInTheDocument();
  });

  it("zeigt am Programmpunkt Nummer und ganzen Titel", () => {
    render(
      <Planung
        pois={[{ ...POMPEJI, number: 14 }]}
        activities={[{ ...AUS_POI, title: LANGER_NAME }]}
      />,
    );

    const block = screen.getByTestId(`activity-block-${AUS_POI.id}`);
    expect(
      within(block).getByTestId(`activity-number-${AUS_POI.id}`),
    ).toHaveTextContent("#14");
    expect(within(block).getByText(LANGER_NAME)).toBeInTheDocument();
  });

  it("haelt Nummer und Titel in getrennten Elementen", () => {
    // Nur so kann der Titel umbrechen, ohne die Zahl mitzunehmen.
    render(
      <Planung
        pois={[{ ...POMPEJI, number: 14 }]}
        activities={[{ ...AUS_POI, title: LANGER_NAME }]}
      />,
    );

    const nummer = screen.getByTestId(`activity-number-${AUS_POI.id}`);
    expect(nummer).toHaveTextContent("#14");
    expect(nummer.textContent).not.toContain(LANGER_NAME);
  });
});

/**
 * Ein sehr flacher Block -- ein Programmpunkt von einer Viertelstunde (req-074).
 * Seine Nummer steht in der Titelzeile und damit im Bereich, den die
 * Mindesthoehe des Blocks freihaelt (siehe timeline-column.layout.test.ts).
 */
describe("POI-Nummer im flachen Block (req-074)", () => {
  it("zeigt die Nummer auch an einem Programmpunkt von 15 Minuten", () => {
    const kurz: Activity = {
      ...AUS_POI,
      startAt: `${ANREISETAG}T10:00`,
      endAt: `${ANREISETAG}T10:15`,
    };
    render(<Planung pois={[{ ...POMPEJI, number: 14 }]} activities={[kurz]} />);

    const block = screen.getByTestId(`activity-block-${kurz.id}`);
    expect(
      within(block).getByTestId(`activity-number-${kurz.id}`),
    ).toHaveTextContent("#14");
    // Die Nummer steht in der ersten Zeile des Blocks -- vor allem, was der
    // flache Block abschneiden koennte.
    expect(block.firstElementChild).toContainElement(
      screen.getByTestId(`activity-number-${kurz.id}`),
    );
  });
});

/**
 * Die Pfeile zwischen den POIs (req-075) zeigen die Reihenfolge des Tages --
 * und damit nur, was auch eingeplant ist. Ein POI, der noch in "Noch
 * unverplant" steht, hat keinen Programmpunkt, liegt nicht auf der Karte und
 * bekommt folglich auch keinen Pfeil.
 */
/** Drei Orte auf einer West-Ost-Linie -- so hat jede Strecke eine Richtung. */
const AM_ANFANG = { lat: 40.63, lng: 14.5 };
const IN_DER_MITTE = { lat: 40.63, lng: 14.6 };
const AM_ENDE = { lat: 40.63, lng: 14.7 };

const ERSTER = { ...poi("poi-1", "Dom von Amalfi"), position: AM_ANFANG };
const ZWEITER = { ...poi("poi-2", "Hafen"), position: IN_DER_MITTE };
const OHNE_PROGRAMMPUNKT = {
  ...poi("poi-3", "Zitronengarten"),
  position: AM_ENDE,
};

function verplant(
  poi: Poi,
  id: string,
  stunde: string,
  tag = ANREISETAG,
): Activity {
  return {
    id,
    tripId: TRIP.id,
    type: "sehenswuerdigkeit",
    title: poi.name,
    shortText: "",
    longText: "",
    startAt: `${tag}T${stunde}:00`,
    endAt: `${tag}T${stunde}:30`,
    poiId: poi.id,
    position: poi.position,
  };
}

const VERPLANT = [
  verplant(ERSTER, "activity-1", "10"),
  verplant(ZWEITER, "activity-2", "12"),
];

/**
 * Rendert die Planungsansicht und wartet den Frame ab, in dem sich die Karte
 * misst (siehe bug-003) -- vorher zeichnet sie weder Marker noch Pfeile.
 */
async function planungMitKarte(pois: Poi[], activities: Activity[]) {
  render(<Planung pois={pois} activities={activities} />);
  await act(async () => {
    await new Promise((fertig) => requestAnimationFrame(() => fertig(null)));
  });
}

function pfeileEinschalten() {
  fireEvent.click(screen.getByTestId("day-route-arrows-toggle"));
}

function pfeile() {
  return screen.queryAllByTestId("route-arrow");
}

/** Wohin ein Pfeil zeigt, in Grad ab Norden -- jsdom rechnet kein CSS. */
function pfeilwinkel() {
  return pfeile().map((pfeil) => Number(pfeil.getAttribute("data-winkel")));
}

describe("Pfeile nur zu verplanten POIs (req-075)", () => {
  it("fuehrt zu einem POI ohne Programmpunkt kein Pfeil", async () => {
    await planungMitKarte([ERSTER, ZWEITER, OHNE_PROGRAMMPUNKT], VERPLANT);

    pfeileEinschalten();

    // Der dritte POI wartet in "Noch unverplant" -- auf der Karte liegt er
    // nicht, und der einzige Pfeil verbindet die beiden verplanten.
    expect(
      within(unverplant()).getByTestId(
        `unplanned-poi-${OHNE_PROGRAMMPUNKT.id}`,
      ),
    ).toBeInTheDocument();
    expect(pfeile()).toHaveLength(1);
    expect(pfeile()[0]).toHaveAttribute("aria-label", "Pfeil von 1 nach 2");
  });

  it("zieht den Pfeil nach, sobald derselbe POI verplant wird", async () => {
    mockServer([ERSTER, ZWEITER, OHNE_PROGRAMMPUNKT], VERPLANT);
    await planungMitKarte([ERSTER, ZWEITER, OHNE_PROGRAMMPUNKT], VERPLANT);
    pfeileEinschalten();
    expect(pfeile()).toHaveLength(1);

    ziehenAuf(OHNE_PROGRAMMPUNKT.id, offsetFuer(14));

    await screen.findByTestId("activity-block-activity-3");
    expect(pfeile().map((pfeil) => pfeil.getAttribute("aria-label"))).toEqual([
      "Pfeil von 1 nach 2",
      "Pfeil von 2 nach 3",
    ]);
  });
});

/**
 * Die Pfeile folgen immer der Reihenfolge, die gerade gilt (req-075): der
 * gewaehlte Reisetag bestimmt, welche Folge sie zeigen, und eine im Zeitstrahl
 * geaenderte Folge zeichnen sie sofort nach. Eingeschaltet bleiben sie dabei.
 */
describe("Pfeile folgen der geltenden Reihenfolge (req-075)", () => {
  const ZWEITER_TAG = "2026-07-19";

  /** Der zweite Tag laeuft andersherum: von Osten nach Westen. */
  const IM_OSTEN = { ...poi("poi-4", "Zitronengarten"), position: AM_ENDE };
  const IM_WESTEN = { ...poi("poi-5", "Kloster"), position: AM_ANFANG };

  const AM_ZWEITEN_TAG = [
    verplant(IM_OSTEN, "activity-3", "10", ZWEITER_TAG),
    verplant(IM_WESTEN, "activity-4", "12", ZWEITER_TAG),
  ];

  it("zeigt nach dem Wechsel des Reisetages die Folge des nun gewaehlten", async () => {
    await planungMitKarte(
      [ERSTER, ZWEITER, IM_OSTEN, IM_WESTEN],
      [...VERPLANT, ...AM_ZWEITEN_TAG],
    );

    pfeileEinschalten();
    // Der Anreisetag laeuft nach Osten -- 90 Grad ab Norden.
    expect(pfeilwinkel()).toEqual([90]);

    fireEvent.click(screen.getByTestId(`day-tab-${ZWEITER_TAG}`));

    // Der zweite Tag laeuft zurueck nach Westen; die Pfeile bleiben an.
    expect(pfeilwinkel()).toEqual([270]);
    expect(screen.getByTestId("day-route-arrows-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("folgt der neuen Reihenfolge, wenn ein Programmpunkt verschoben wird", async () => {
    mockServer([ERSTER, ZWEITER], VERPLANT);
    await planungMitKarte([ERSTER, ZWEITER], VERPLANT);

    pfeileEinschalten();
    expect(pfeilwinkel()).toEqual([90]);

    // Den ersten Programmpunkt hinter den zweiten ziehen -- die Folge kehrt
    // sich um, und mit ihr der Pfeil.
    programmpunktZiehenAuf("activity-1", offsetFuer(14));

    await waitFor(() => expect(pfeilwinkel()).toEqual([270]));
    expect(pfeile()[0]).toHaveAttribute("aria-label", "Pfeil von 1 nach 2");
  });
});

/**
 * Der Schalter fuer die Pfeile (req-075) ruehrt den Ausschnitt nicht an: wer
 * sich eine Ecke des Tages herangezogen hat, behaelt sie (bug-048).
 */
describe("Pfeile lassen den Ausschnitt stehen (req-075)", () => {
  it("rueckt die Karte beim Ein- und Ausschalten nicht", async () => {
    await planungMitKarte([ERSTER, ZWEITER], VERPLANT);
    const karte = MapLibreMap.live();
    const gerueckt = karte.fitBoundsCalls.length;
    const mitte = karte.center;

    pfeileEinschalten();
    fireEvent.click(screen.getByTestId("day-route-arrows-toggle"));

    expect(karte.fitBoundsCalls).toHaveLength(gerueckt);
    expect(karte.center).toBe(mitte);
  });
});

/**
 * Der Zoom des Zeitstrahls (req-076): dieselbe Stunde wird hoeher oder flacher
 * dargestellt. Bedient wird er ueber zwei Schalter in der Titelzeile --
 * angeklickt wie angetippt derselbe Weg.
 *
 * Gemessen wird am Raster und an den Bloecken: jsdom rechnet kein CSS, aber
 * Hoehe und Lage stehen als Pixelmass am Element (siehe timeline-column.tsx).
 */
function zoomGroesser() {
  fireEvent.click(screen.getByTestId("zoom-groesser"));
}

function zoomKleiner() {
  fireEvent.click(screen.getByTestId("zoom-kleiner"));
}

/** Die Hoehe des Rasters in Pixeln -- darin liegen alle Stunden des Tages. */
function rasterhoehe() {
  return Number(
    screen.getByTestId("timeline-grid").style.height.replace("px", ""),
  );
}

/** Die Hoehe eines Programmpunkt-Blocks in Pixeln. */
function blockhoehe(activityId: string) {
  return Number(
    screen
      .getByTestId(`activity-block-${activityId}`)
      .style.height.replace("px", ""),
  );
}

/** Die Stundenbeschriftungen des Rasters -- "08:00", "09:00", ... */
function stundenlinien() {
  return screen.getAllByText(/^\d\d:00$/);
}

describe("Zeitstrahl vergroessern (req-076)", () => {
  it("stellt dieselbe Stunde nach dem Vergroessern hoeher dar", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const vorher = blockhoehe(AUS_POI.id);
    const rasterVorher = rasterhoehe();

    zoomGroesser();

    expect(blockhoehe(AUS_POI.id)).toBeGreaterThan(vorher);
    expect(rasterhoehe()).toBeGreaterThan(rasterVorher);
    // Dieselben Stunden, nur hoeher gezeichnet -- der Tag wird nicht laenger.
    expect(stundenlinien()).toHaveLength(15);
  });

  it("bleibt an der hoechsten Stufe stehen", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    // Ueber die Obergrenze hinaus geht es nicht (req-076, Constraints).
    for (let klick = 0; klick < 10; klick += 1) {
      if (!screen.getByTestId("zoom-groesser").hasAttribute("disabled")) {
        zoomGroesser();
      }
    }
    const hoechste = rasterhoehe();
    expect(screen.getByTestId("zoom-groesser")).toBeDisabled();

    zoomGroesser();

    expect(rasterhoehe()).toBe(hoechste);
  });
});

describe("Zeitstrahl verkleinern (req-076)", () => {
  it("laesst nach dem Verkleinern mehr Stunden auf einmal sehen", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const stunden = stundenlinien().length;
    const vorher = rasterhoehe();

    zoomKleiner();

    // Dieselben Stunden auf weniger Pixeln: in dieselbe Spalte passen damit
    // mehr davon, ohne zu rollen.
    expect(stundenlinien()).toHaveLength(stunden);
    expect(rasterhoehe()).toBeLessThan(vorher);
    expect(blockhoehe(AUS_POI.id)).toBeLessThan(2.5 * HOUR_HEIGHT_PX);
  });

  it("bleibt an der flachsten Stufe stehen", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    for (let klick = 0; klick < 10; klick += 1) {
      if (!screen.getByTestId("zoom-kleiner").hasAttribute("disabled")) {
        zoomKleiner();
      }
    }
    const flachste = rasterhoehe();
    expect(screen.getByTestId("zoom-kleiner")).toBeDisabled();

    zoomKleiner();

    expect(rasterhoehe()).toBe(flachste);
  });

  it("findet nach dem Verkleinern wieder in die Grundeinstellung", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    const grund = rasterhoehe();

    zoomKleiner();
    zoomGroesser();

    expect(rasterhoehe()).toBe(grund);
  });
});

/**
 * Der Zoom aendert die Treffsicherheit, nicht die Schrittweite (req-076): das
 * Raster bleibt bei 15 Minuten (req-039, req-040), aber eine Viertelstunde
 * bekommt vergroessert mehr Pixel. Wer auf 10:15 zieht, landet auf 10:15 --
 * auch wenn der Finger ein paar Pixel daneben liegt.
 */
/** Der Abstand einer Uhrzeit von der Rasteroberkante bei dieser Stundenhoehe. */
function offsetBei(hourHeightPx: number, stunden: number, minuten = 0) {
  return (stunden - 8 + minuten / 60) * hourHeightPx;
}

const VERGROESSERT_PX = groessereStundenhoehePx(HOUR_HEIGHT_PX);
const VERKLEINERT_PX = kleinereStundenhoehePx(HOUR_HEIGHT_PX);

describe("Genauer ziehen bei groesserem Zoom (req-076)", () => {
  it("legt einen auf 10:15 gezogenen POI auf 10:15", async () => {
    const { anfragen } = mockServer([POMPEJI]);
    render(<Planung pois={[POMPEJI]} />);

    zoomGroesser();
    ziehenAuf(POMPEJI.id, offsetBei(VERGROESSERT_PX, 10, 15));

    await screen.findByTestId("activity-block-activity-1");
    expect(anfragen[0].body).toMatchObject({
      startAt: `${ANREISETAG}T10:15`,
    });
  });

  it("verzeiht dabei einen Griff, der in der Grundeinstellung 10:30 ergaebe", async () => {
    // 12 px sind in der Grundeinstellung genau eine Viertelstunde -- genau der
    // Fehlgriff aus req-076, Goal.
    const daneben = 12;
    const { anfragen } = mockServer([POMPEJI]);
    render(<Planung pois={[POMPEJI]} />);

    zoomGroesser();
    ziehenAuf(POMPEJI.id, offsetBei(VERGROESSERT_PX, 10, 15) + daneben);

    await screen.findByTestId("activity-block-activity-1");
    expect(anfragen[0].body).toMatchObject({
      startAt: `${ANREISETAG}T10:15`,
    });
  });

  it("zeigt den Umriss vergroessert an derselben Stelle wie den Block", async () => {
    // Umriss und Block rechnen mit derselben Stundenhoehe (req-046): sonst
    // landete der Programmpunkt neben dem Umriss, der ihn angekuendigt hat.
    mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    zoomGroesser();

    fireEvent.dragStart(screen.getByTestId(`activity-block-${AUS_POI.id}`));
    ueberRasterZiehen(offsetBei(VERGROESSERT_PX, 14));

    expect(umriss()).toHaveTextContent("14:00");
    expect(umriss()?.style.top).toBe(`${offsetBei(VERGROESSERT_PX, 14)}px`);
  });
});

describe("Einrasten bei geaendertem Zoom (req-076)", () => {
  it("rastet einen verschobenen Programmpunkt verkleinert auf 15 Minuten ein", async () => {
    const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    zoomKleiner();
    programmpunktZiehenAuf(AUS_POI.id, offsetBei(VERKLEINERT_PX, 14, 20));

    await waitFor(() => expect(anfragen).toHaveLength(1));
    expect(anfragen[0]).toMatchObject({
      method: "PATCH",
      body: { id: AUS_POI.id, startAt: `${ANREISETAG}T14:15` },
    });
    // Die Dauer bleibt, und die Zeiten stehen auf der Viertelstunde.
    await waitFor(() =>
      expect(
        screen.getByTestId(`activity-block-${AUS_POI.id}`),
      ).toHaveTextContent("14:15 – 16:45"),
    );
  });

  it("rastet auch vergroessert auf 15 Minuten ein und nicht feiner", async () => {
    const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    zoomGroesser();
    programmpunktZiehenAuf(AUS_POI.id, offsetBei(VERGROESSERT_PX, 14, 20));

    await waitFor(() => expect(anfragen).toHaveLength(1));
    expect(anfragen[0]).toMatchObject({
      method: "PATCH",
      body: { id: AUS_POI.id, startAt: `${ANREISETAG}T14:15` },
    });
  });

  it("rastet eine gezogene Kante verkleinert weiterhin auf 15 Minuten ein", async () => {
    const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    zoomKleiner();
    randZiehenAuf(AUS_POI.id, offsetBei(VERKLEINERT_PX, 16, 20));

    await waitFor(() => expect(anfragen).toHaveLength(1));
    expect(anfragen[0]).toMatchObject({
      method: "PATCH",
      body: { id: AUS_POI.id, endAt: `${ANREISETAG}T16:15` },
    });
  });
});

/**
 * Der gewaehlte Zoom ueberdauert den Wechsel des Reisetages (req-076): er
 * liegt in der Planungsansicht und nicht im Zeitstrahl, der beim Wechsel neu
 * rechnet. Gespeichert ist er nicht -- eine neu geoeffnete Planung beginnt in
 * der Grundeinstellung (wie die Filter, bug-052).
 */
describe("Zoom bleibt beim Wechsel des Reisetages (req-076)", () => {
  const ZWEITER_TAG = "2026-07-19";

  /** Eine Stunde am zweiten Reisetag -- beide Tage liegen in 08:00 bis 22:00. */
  const AM_ZWEITEN_TAG: Activity = {
    ...AUS_POI,
    id: "activity-9",
    startAt: `${ZWEITER_TAG}T09:00`,
    endAt: `${ZWEITER_TAG}T10:00`,
  };

  function tagWaehlen(date: string) {
    fireEvent.click(screen.getByTestId(`day-tab-${date}`));
  }

  it("gilt am anderen Reisetag und nach dem Zurueckkommen weiter", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI, AM_ZWEITEN_TAG]} />);
    zoomGroesser();
    const vergroessert = rasterhoehe();

    tagWaehlen(ZWEITER_TAG);

    // Die Stunde des zweiten Tages ist so hoch wie die gewaehlte Stufe.
    expect(blockhoehe(AM_ZWEITEN_TAG.id)).toBe(VERGROESSERT_PX);
    expect(rasterhoehe()).toBe(vergroessert);

    tagWaehlen(ANREISETAG);

    expect(rasterhoehe()).toBe(vergroessert);
    expect(blockhoehe(AUS_POI.id)).toBe(2.5 * VERGROESSERT_PX);
  });

  it("behaelt auch den verkleinerten Zeitstrahl ueber den Tageswechsel", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI, AM_ZWEITEN_TAG]} />);
    zoomKleiner();

    tagWaehlen(ZWEITER_TAG);

    expect(blockhoehe(AM_ZWEITEN_TAG.id)).toBe(VERKLEINERT_PX);
  });

  it("beginnt in einer neu geoeffneten Planung wieder in der Grundeinstellung", () => {
    const erste = render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);
    zoomGroesser();
    erste.unmount();

    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    expect(blockhoehe(AUS_POI.id)).toBe(2.5 * HOUR_HEIGHT_PX);
  });
});

/**
 * Der Zoom ruehrt die Zeiten nicht an (req-076): er aendert die Darstellung,
 * nicht den Plan. Nach dem Vergroessern steht an jedem Programmpunkt dieselbe
 * Uhrzeit wie vorher, und gespeichert wurde nichts.
 */
describe("Zeiten bleiben beim Zoomen stehen (req-076)", () => {
  it("zeigt nach dem Vergroessern dieselben Uhrzeiten am Programmpunkt", () => {
    const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI, OHNE_POI]} />);

    zoomGroesser();

    expect(
      screen.getByTestId(`activity-block-${AUS_POI.id}`),
    ).toHaveTextContent("10:00 – 12:30");
    expect(
      screen.getByTestId(`activity-block-${OHNE_POI.id}`),
    ).toHaveTextContent("19:00 – 20:30");
    // Verschoben hat der Zoom nichts -- geschrieben wird darum auch nichts.
    expect(anfragen).toHaveLength(0);
  });

  it("zeigt auch verkleinert dieselben Uhrzeiten", () => {
    const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    zoomKleiner();
    zoomKleiner();

    expect(
      screen.getByTestId(`activity-block-${AUS_POI.id}`),
    ).toHaveTextContent("10:00 – 12:30");
    expect(anfragen).toHaveLength(0);
  });

  it("laesst jeden Block an der Stelle seiner Uhrzeit liegen", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI, OHNE_POI]} />);

    zoomGroesser();

    // 10:00 und 19:00 im Raster ab 08:00 -- gemessen in der gewaehlten Stufe.
    expect(screen.getByTestId(`activity-block-${AUS_POI.id}`).style.top).toBe(
      `${offsetBei(VERGROESSERT_PX, 10)}px`,
    );
    expect(screen.getByTestId(`activity-block-${OHNE_POI.id}`).style.top).toBe(
      `${offsetBei(VERGROESSERT_PX, 19)}px`,
    );
  });
});

/**
 * Ueberlappende Programmpunkte teilen sich die Breite (req-039) -- daran
 * aendert der Zoom nichts: er wirkt senkrecht, nicht waagrecht (req-076, Out
 * of Scope).
 */
describe("Ueberlappende Programmpunkte beim Zoomen (req-076)", () => {
  /** Liegt mitten im ersten Programmpunkt -- beide teilen sich die Breite. */
  const GLEICHZEITIG: Activity = {
    ...OHNE_POI,
    id: "activity-5",
    startAt: `${ANREISETAG}T11:00`,
    endAt: `${ANREISETAG}T12:00`,
  };

  function spuren() {
    return [AUS_POI, GLEICHZEITIG].map((activity) => {
      const block = screen.getByTestId(`activity-block-${activity.id}`);
      return { left: block.style.left, width: block.style.width };
    });
  }

  it("laesst beide sich die Breite weiterhin teilen", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI, GLEICHZEITIG]} />);
    const vorher = spuren();
    expect(vorher).toEqual([
      { left: "0%", width: "calc(50% - 4px)" },
      { left: "50%", width: "calc(50% - 4px)" },
    ]);

    zoomGroesser();
    expect(spuren()).toEqual(vorher);

    zoomKleiner();
    zoomKleiner();
    expect(spuren()).toEqual(vorher);
  });

  it("aendert dabei nur die Hoehen", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI, GLEICHZEITIG]} />);

    zoomGroesser();

    expect(blockhoehe(AUS_POI.id)).toBe(2.5 * VERGROESSERT_PX);
    expect(blockhoehe(GLEICHZEITIG.id)).toBe(VERGROESSERT_PX);
    // Der zweite beginnt eine Stunde nach dem ersten -- auch das bleibt.
    expect(
      screen.getByTestId(`activity-block-${GLEICHZEITIG.id}`).style.top,
    ).toBe(`${offsetBei(VERGROESSERT_PX, 11)}px`);
  });
});

/**
 * Der Zoom mit dem Finger (req-076): auf dem iPad gibt es keinen Mausklick.
 * Ein Tipp auf den Schalter ist eine Folge von Zeiger-Ereignissen, auf die der
 * Browser ein `click` legt -- der Schalter darf sie nicht abfangen (vgl.
 * bug-017, wo der Zug am Zeitstrahl genau daran haengen blieb).
 */
describe("Zoom mit dem Finger (req-076)", () => {
  /** Ein Tipp mit dem Finger auf einen Schalter. */
  function antippen(testId: string) {
    const schalter = screen.getByTestId(testId);
    const zeiger = { pointerId: 7, pointerType: "touch" };
    fireEvent.pointerDown(schalter, zeiger);
    fireEvent.pointerUp(schalter, zeiger);
    fireEvent.click(schalter, { detail: 0 });
  }

  it("vergroessert den Zeitstrahl auf einen Fingertipp", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    antippen("zoom-groesser");

    expect(blockhoehe(AUS_POI.id)).toBe(2.5 * VERGROESSERT_PX);
  });

  it("verkleinert ihn auf einen Fingertipp", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    antippen("zoom-kleiner");

    expect(blockhoehe(AUS_POI.id)).toBe(2.5 * VERKLEINERT_PX);
  });

  it("beginnt mit dem Tipp keinen Zug am Zeitstrahl", () => {
    // Der Finger auf dem Schalter gehoert dem Schalter: waehrenddessen darf
    // kein Umriss erscheinen (req-046).
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    antippen("zoom-groesser");

    expect(umriss()).toBeNull();
    expect(
      screen.getByTestId(`activity-block-${AUS_POI.id}`),
    ).toHaveTextContent("10:00 – 12:30");
  });
});

/**
 * Die Stufen ueber der bisherigen Obergrenze (req-078): 96 px je Stunde
 * ergaben 24 px je Viertelstunde -- auf dem iPad mit dem Finger zu knapp fuer
 * einen Programmpunkt, der genau auf 10:15 soll. Auf der hoechsten Stufe
 * erreicht eine Viertelstunde jetzt die 44 px, die stack.md fuer
 * Bedienelemente verlangt.
 *
 * Was der Zoom schon vorher nicht angeruehrt hat, ruehrt er auch hier nicht
 * an: das Raster bleibt bei 15 Minuten (req-039, req-040), und ueberlappende
 * Programmpunkte teilen sich weiterhin die Breite (req-039).
 */
describe("Die neuen Zoomstufen (req-078)", () => {
  /** Vergroessert bis zur hoechsten Stufe -- dort wird der Schalter stumm. */
  function bisZurHoechstenStufe() {
    for (let klick = 0; klick < ZOOM_STUFEN_PX.length; klick += 1) {
      if (!screen.getByTestId("zoom-groesser").hasAttribute("disabled")) {
        zoomGroesser();
      }
    }
    expect(screen.getByTestId("zoom-groesser")).toBeDisabled();
  }

  it("gibt einer Viertelstunde auf der hoechsten Stufe 44 px", () => {
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI]} />);

    bisZurHoechstenStufe();

    // Der Block dauert zweieinhalb Stunden -- daraus faellt die Hoehe einer
    // Stunde und damit die einer Viertelstunde.
    const stunde = blockhoehe(AUS_POI.id) / 2.5;
    expect(stunde).toBe(ZOOM_MAX_PX);
    expect(stunde / 4).toBeGreaterThanOrEqual(44);
  });

  it("legt einen auf der hoechsten Stufe auf 10:15 gezogenen POI auf 10:15", async () => {
    const { anfragen } = mockServer([POMPEJI]);
    render(<Planung pois={[POMPEJI]} />);

    bisZurHoechstenStufe();
    ziehenAuf(POMPEJI.id, offsetBei(ZOOM_MAX_PX, 10, 15));

    await screen.findByTestId("activity-block-activity-1");
    expect(anfragen[0].body).toMatchObject({
      startAt: `${ANREISETAG}T10:15`,
    });
  });

  /**
   * Und zwar auf der ganzen Trefferflaeche: ein Griff 43 px unterhalb von
   * 10:15 liegt noch in derselben Viertelstunde und ergibt weiterhin 10:15
   * -- das ist der Sinn der 44 px. In der Grundeinstellung waere derselbe
   * Griff laengst 11:00 (dort ist eine Viertelstunde nur 12 px hoch).
   */
  it("verzeiht auf der hoechsten Stufe einen Griff bis zum Rand der Viertelstunde", async () => {
    const { anfragen } = mockServer([POMPEJI]);
    render(<Planung pois={[POMPEJI]} />);

    bisZurHoechstenStufe();
    ziehenAuf(POMPEJI.id, offsetBei(ZOOM_MAX_PX, 10, 15) + 43);

    await screen.findByTestId("activity-block-activity-1");
    expect(anfragen[0].body).toMatchObject({
      startAt: `${ANREISETAG}T10:15`,
    });
  });

  it("rastet auf jeder neuen Stufe weiterhin auf 15 Minuten ein", async () => {
    // Die Stufen ueber der bisherigen Obergrenze (96 px) -- jede fuer sich.
    const neue = ZOOM_STUFEN_PX.filter((stufe) => stufe > 96);
    expect(neue.length).toBeGreaterThan(0);

    for (const stufe of neue) {
      const { anfragen } = mockServer([POMPEJI], [AUS_POI]);
      const ansicht = render(
        <Planung pois={[POMPEJI]} activities={[AUS_POI]} />,
      );

      for (let klick = 0; klick < ZOOM_STUFEN_PX.length; klick += 1) {
        if (blockhoehe(AUS_POI.id) / 2.5 < stufe) zoomGroesser();
      }
      expect(blockhoehe(AUS_POI.id) / 2.5).toBe(stufe);

      // 14:20 liegt zwischen zwei Viertelstunden -- eingerastet wird auf die
      // davor, nicht auf 14:20.
      programmpunktZiehenAuf(AUS_POI.id, offsetBei(stufe, 14, 20));

      await waitFor(() => expect(anfragen).toHaveLength(1));
      expect(anfragen[0]).toMatchObject({
        method: "PATCH",
        body: { id: AUS_POI.id, startAt: `${ANREISETAG}T14:15` },
      });
      ansicht.unmount();
    }
  });

  it("laesst ueberlappende Programmpunkte sich die Breite weiterhin teilen", () => {
    /** Liegt mitten im ersten Programmpunkt (req-039). */
    const gleichzeitig: Activity = {
      ...OHNE_POI,
      id: "activity-5",
      startAt: `${ANREISETAG}T11:00`,
      endAt: `${ANREISETAG}T12:00`,
    };
    render(<Planung pois={[POMPEJI]} activities={[AUS_POI, gleichzeitig]} />);

    const spuren = () =>
      [AUS_POI, gleichzeitig].map((activity) => {
        const block = screen.getByTestId(`activity-block-${activity.id}`);
        return { left: block.style.left, width: block.style.width };
      });
    const vorher = spuren();
    expect(vorher).toEqual([
      { left: "0%", width: "calc(50% - 4px)" },
      { left: "50%", width: "calc(50% - 4px)" },
    ]);

    bisZurHoechstenStufe();

    // Waagrecht bleibt alles, wie es war; senkrecht sind beide gewachsen.
    expect(spuren()).toEqual(vorher);
    expect(blockhoehe(AUS_POI.id)).toBe(2.5 * ZOOM_MAX_PX);
    expect(blockhoehe(gleichzeitig.id)).toBe(ZOOM_MAX_PX);
  });
});
