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
import { groupKey } from "@/lib/activities/groups";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Die Options-Gruppe im Zeitstrahl des Planers (bug-053).
 *
 * Zwei Programmpunkte mit exakt gleichem Beginn und Ende sind eine Gruppe
 * (req-004) -- gezeichnet wurde davon aber nur die gewaehlte Alternative, und
 * die Titel der uebrigen lagen darunter: dass dort mehrere Moeglichkeiten
 * liegen, war nicht zu sehen und keine davon zu waehlen. Geprueft wird
 * deshalb, dass die Gruppe als solche erkennbar ist, jede Alternative ihre
 * eigene Zeile bekommt, die gewaehlte gekennzeichnet ist und sich eine andere
 * waehlen laesst, ohne dass sich eine Zeit aendert.
 *
 * Gesucht wird im Zeitstrahl ueber die Kennzeichnungen der Elemente und nicht
 * ueber ihre Rolle: jeder Block traegt seine Breite als `calc()`, und daran
 * scheitert die Stilberechnung von jsdom (siehe planung-view.test.tsx, das
 * ebenso vorgeht).
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

function poi(id: string, name: string, number: number): Poi {
  return {
    id,
    tripId: TRIP.id,
    number,
    name,
    ort: "Pompei",
    type: "sehenswuerdigkeit",
    position: { lat: 40.7489, lng: 14.4989 },
    status: "gesetzt",
  };
}

const POMPEJI = poi("poi-pompeji", "Ausgrabungsstätte Pompeji", 1);
const HERCULANEUM = poi("poi-herculaneum", "Ausgrabungen von Herculaneum", 2);
const VESUV = poi("poi-vesuv", "Aufstieg zum Vesuv", 3);

/** Alternativen zu exakt derselben Zeit -- eine Gruppe (req-004). */
function alternative(id: string, title: string, poiId: string): Activity {
  return {
    id,
    tripId: TRIP.id,
    type: "sehenswuerdigkeit",
    title,
    shortText: "",
    longText: "",
    startAt: `${ANREISETAG}T10:00`,
    endAt: `${ANREISETAG}T12:00`,
    poiId,
  };
}

const ERSTE = alternative("activity-1", POMPEJI.name, POMPEJI.id);
const ZWEITE = alternative("activity-2", HERCULANEUM.name, HERCULANEUM.id);
const DRITTE = alternative("activity-3", VESUV.name, VESUV.id);

const GRUPPEN_KEY = groupKey({
  tripId: TRIP.id,
  startAt: ERSTE.startAt,
  endAt: ERSTE.endAt,
});

/** Ein Programmpunkt, der zu keiner Gruppe gehoert. */
const EINZELN: Activity = {
  id: "activity-einzeln",
  tripId: TRIP.id,
  type: "restaurant",
  title: "Abendessen im Hotel",
  shortText: "",
  longText: "",
  startAt: `${ANREISETAG}T19:00`,
  endAt: `${ANREISETAG}T20:30`,
};

/**
 * Der Server, soweit die Gruppe ihn braucht: die Wahl wird abgeschickt (siehe
 * app/api/activity-option-selection/route.ts), eine Alternative laesst sich
 * entfernen. Jede andere Anfrage waere ein Fehler -- eine Wahl aendert keine
 * Zeiten.
 */
function mockServer(vorhandene: Activity[]) {
  const anfragen: {
    url: string;
    method: string;
    body: Record<string, unknown>;
  }[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      anfragen.push({ url: String(url), method: String(init.method), body });

      if (String(url).includes("activity-option-selection")) {
        return Response.json({ status: "ok" });
      }
      if (init.method === "DELETE") {
        const activity = vorhandene.find((a) => a.id === body.id);
        return Response.json(
          activity ? { activity } : { error: "unknown activity" },
          { status: activity ? 200 : 404 },
        );
      }
      return Response.json({ error: "unerwartete Anfrage" }, { status: 500 });
    }),
  );

  return { anfragen };
}

/**
 * Die Planungsansicht mitsamt der Listen, die sonst in PlanView liegen -- die
 * Programmpunkte und die gewaehlte Alternative je Gruppe (bug-053).
 */
function Planung({
  activities,
  selections = {},
  waehlbar = true,
}: {
  activities: Activity[];
  selections?: Record<string, string>;
  waehlbar?: boolean;
}) {
  const [current, setCurrent] = useState(activities);
  const [optionSelections, setOptionSelections] = useState(selections);
  return (
    <PlanungView
      trip={TRIP}
      pois={[POMPEJI, HERCULANEUM, VESUV]}
      activities={current}
      transfers={[]}
      today={TODAY}
      optionSelections={optionSelections}
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
      onOptionSelected={
        waehlbar
          ? (group, activityId) =>
              setOptionSelections((gewaehlt) => ({
                ...gewaehlt,
                [groupKey(group)]: activityId,
              }))
          : undefined
      }
    />
  );
}

/** Der Rahmen der Gruppe -- alles, was zu ihr gehoert, liegt darin. */
function gruppe() {
  return screen.getByTestId(`option-group-${GRUPPEN_KEY}`);
}

/** Waehlt eine Alternative, wie es ein Klick auf ihren Knopf tut. */
function waehlen(activityId: string) {
  fireEvent.click(screen.getByTestId(`option-waehlen-${activityId}`));
}

describe("Options-Gruppe im Zeitstrahl (bug-053)", () => {
  beforeEach(() => {
    mockServer([ERSTE, ZWEITE]);
  });

  it("zeigt jede Alternative mit ihrem Titel, nicht nur die erste", () => {
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    expect(within(gruppe()).getByText(ERSTE.title)).toBeInTheDocument();
    expect(within(gruppe()).getByText(ZWEITE.title)).toBeInTheDocument();
  });

  it("gibt jeder Alternative ihre eigene Zeile in der Gruppe", () => {
    // Uebereinanderliegende Titel waren der Fehler: beide Alternativen lagen
    // als ein Block an derselben Stelle des Rasters.
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    const zeilen = within(gruppe()).getAllByTestId(/^activity-block-/);
    expect(zeilen).toHaveLength(2);
    for (const zeile of zeilen) {
      // Keine Zeile wird selbst im Raster platziert -- sie stehen
      // untereinander im Rahmen der Gruppe.
      expect(zeile.style.top).toBe("");
      expect(zeile.style.height).toBe("");
    }
  });

  it("nennt die Zahl der Alternativen und ihren Zeitraum", () => {
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    expect(gruppe()).toHaveTextContent("2 Optionen · 10:00 – 12:00");
    expect(gruppe()).toHaveAttribute(
      "aria-label",
      "2 Optionen · 10:00 – 12:00",
    );
  });

  it("nennt bei drei Alternativen drei", () => {
    render(<Planung activities={[ERSTE, ZWEITE, DRITTE]} />);

    expect(gruppe()).toHaveTextContent("3 Optionen · 10:00 – 12:00");
    expect(within(gruppe()).getAllByTestId(/^activity-block-/)).toHaveLength(3);
  });

  it("ist als Gruppe von einem einzelnen Programmpunkt zu unterscheiden", () => {
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    // Genau eine Gruppe, und der einzelne Programmpunkt liegt nicht darin.
    expect(screen.getAllByTestId(/^option-group-/)).toHaveLength(1);
    expect(gruppe()).toHaveAttribute("role", "group");
    expect(within(gruppe()).queryByText(EINZELN.title)).toBeNull();
    expect(
      screen.getByTestId(`activity-block-${EINZELN.id}`).style.top,
    ).not.toBe("");
  });

  it("gibt der Gruppe Platz für jede ihrer Alternativen", () => {
    // Eine Gruppe von zwei Stunden ist hoch genug; sie wird nicht flacher
    // gezeichnet, als ihre Alternativen zusammen brauchen (bug-053).
    render(<Planung activities={[ERSTE, ZWEITE, DRITTE]} />);

    const hoehe = Number(gruppe().style.height.replace("px", ""));
    const mindestens = Number(gruppe().style.minHeight.replace("px", ""));
    expect(mindestens).toBeGreaterThan(0);
    expect(Math.max(hoehe, mindestens)).toBeGreaterThanOrEqual(mindestens);
  });

  it("kennzeichnet ohne gespeicherte Wahl die erste Alternative als gewählt", () => {
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    expect(screen.getByTestId(`option-gewaehlt-${ERSTE.id}`)).toHaveTextContent(
      "Gewählt",
    );
    expect(screen.queryByTestId(`option-gewaehlt-${ZWEITE.id}`)).toBeNull();
    expect(screen.getByTestId(`option-waehlen-${ZWEITE.id}`)).toHaveAttribute(
      "aria-label",
      `Alternative „${ZWEITE.title}“ wählen`,
    );
  });

  it("kennzeichnet die gespeicherte Wahl", () => {
    render(
      <Planung
        activities={[ERSTE, ZWEITE, EINZELN]}
        selections={{ [GRUPPEN_KEY]: ZWEITE.id }}
      />,
    );

    expect(
      screen.getByTestId(`option-gewaehlt-${ZWEITE.id}`),
    ).toHaveTextContent("Gewählt");
    expect(screen.queryByTestId(`option-gewaehlt-${ERSTE.id}`)).toBeNull();
  });

  it("wechselt auf Knopfdruck zur anderen Alternative", () => {
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    waehlen(ZWEITE.id);

    expect(
      screen.getByTestId(`option-gewaehlt-${ZWEITE.id}`),
    ).toHaveTextContent("Gewählt");
    expect(screen.queryByTestId(`option-gewaehlt-${ERSTE.id}`)).toBeNull();
  });

  it("speichert die Wahl für die ganze Reise", async () => {
    const { anfragen } = mockServer([ERSTE, ZWEITE]);
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    waehlen(ZWEITE.id);

    await waitFor(() => expect(anfragen).toHaveLength(1));
    expect(anfragen[0].url).toContain("/api/activity-option-selection");
    expect(anfragen[0].body).toEqual({
      tripId: TRIP.id,
      startAt: ERSTE.startAt,
      endAt: ERSTE.endAt,
      activityId: ZWEITE.id,
    });
  });

  it("lässt beim Wechseln die Zeiten unberührt", async () => {
    const { anfragen } = mockServer([ERSTE, ZWEITE]);
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);
    const lage = { top: gruppe().style.top, height: gruppe().style.height };

    waehlen(ZWEITE.id);

    await waitFor(() => expect(anfragen).toHaveLength(1));
    // Umgeplant wird nichts: kein PATCH auf einen Programmpunkt -- und die
    // Gruppe liegt danach genau da, wo sie lag.
    expect(anfragen.every((anfrage) => anfrage.method === "POST")).toBe(true);
    expect(gruppe()).toHaveTextContent("10:00 – 12:00");
    expect({ top: gruppe().style.top, height: gruppe().style.height }).toEqual(
      lage,
    );
  });

  it("trägt an jeder Alternative die Nummer ihres POI (req-074)", () => {
    // Eine Gruppe vereint mehrere POIs, und jeder hat seine eigene Nummer.
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    expect(screen.getByTestId(`activity-number-${ERSTE.id}`)).toHaveTextContent(
      "#1",
    );
    expect(
      screen.getByTestId(`activity-number-${ZWEITE.id}`),
    ).toHaveTextContent("#2");
  });

  it("lässt eine einzelne Alternative entfernen", async () => {
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} />);

    fireEvent.click(screen.getByTestId(`remove-activity-${ZWEITE.id}`));

    // Uebrig bleibt ein einzelner Programmpunkt -- keine Gruppe mehr. Der POI
    // der entfernten Alternative steht danach wieder in "Noch unverplant",
    // gesucht wird deshalb im Zeitstrahl.
    await waitFor(() =>
      expect(screen.queryAllByTestId(/^option-group-/)).toHaveLength(0),
    );
    const zeitstrahl = within(screen.getByTestId("timeline-grid"));
    expect(zeitstrahl.getByText(ERSTE.title)).toBeInTheDocument();
    expect(zeitstrahl.queryByText(ZWEITE.title)).toBeNull();
  });

  it("zeigt ohne Rückruf für die Wahl keinen Knopf zum Wählen", () => {
    // Dann steht die Gruppe zur Ansicht: die Alternativen sind zu sehen, die
    // Wahl bleibt, wie sie ist.
    render(<Planung activities={[ERSTE, ZWEITE, EINZELN]} waehlbar={false} />);

    expect(screen.queryByTestId(`option-waehlen-${ZWEITE.id}`)).toBeNull();
    expect(within(gruppe()).getByText(ZWEITE.title)).toBeInTheDocument();
    expect(
      screen.getByTestId(`option-gewaehlt-${ERSTE.id}`),
    ).toBeInTheDocument();
  });
});
