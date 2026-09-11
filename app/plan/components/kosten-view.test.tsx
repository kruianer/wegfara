import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Activity } from "@/lib/activities/types";
import type { Poi } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import { KostenView } from "./kosten-view";

const REISE: Trip = {
  id: "reise-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: REISE.id,
    number: 1,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.649, lng: 14.612 },
    status: "gesetzt",
    ...overrides,
  };
}

function programmpunkt(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    tripId: REISE.id,
    type: "sehenswuerdigkeit",
    title: "Villa Rufolo",
    shortText: "",
    longText: "",
    startAt: "2026-07-19T10:00",
    endAt: "2026-07-19T12:00",
    poiId: "poi-1",
    ...overrides,
  };
}

function zeige({
  activities = [programmpunkt()],
  pois = [poi()],
  teilnehmerzahl = 4,
}: {
  activities?: Activity[];
  pois?: Poi[];
  teilnehmerzahl?: number;
} = {}) {
  return render(
    <KostenView
      trip={REISE}
      activities={activities}
      pois={pois}
      teilnehmerzahl={teilnehmerzahl}
    />,
  );
}

/** Die Zeilen der Tabelle ohne ihre Kopfzeile. */
function zeilen() {
  return within(screen.getByTestId("kostenzeilen")).getAllByRole("row");
}

describe("Bereich Kosten (req-062)", () => {
  it("zeigt zu drei Programmpunkten drei Zeilen", () => {
    zeige({
      activities: [
        programmpunkt({ id: "a1", poiId: "poi-1" }),
        programmpunkt({
          id: "a2",
          poiId: "poi-2",
          startAt: "2026-07-20T10:00",
          endAt: "2026-07-20T11:00",
        }),
        programmpunkt({
          id: "a3",
          poiId: "poi-3",
          startAt: "2026-07-21T10:00",
          endAt: "2026-07-21T11:00",
        }),
      ],
      pois: [
        poi({ id: "poi-1" }),
        poi({ id: "poi-2", name: "Pompeji" }),
        poi({ id: "poi-3", name: "Capri" }),
      ],
    });

    expect(zeilen()).toHaveLength(3);
  });

  it("zeigt den Preis je Person, wie er am POI steht (req-061)", () => {
    zeige({ pois: [poi({ kostenCent: 1250 })] });

    expect(zeilen()[0]).toHaveTextContent("12,50");
  });

  it("zeigt als Anzahl die Teilnehmerzahl der Reise", () => {
    zeige({ teilnehmerzahl: 4 });

    expect(
      within(zeilen()[0]).getByTestId("kostenzeile-anzahl"),
    ).toHaveTextContent("4");
  });

  it("zeigt als Gesamt den Preis mal der Anzahl", () => {
    zeige({ pois: [poi({ kostenCent: 1250 })], teilnehmerzahl: 4 });

    expect(
      within(zeilen()[0]).getByTestId("kostenzeile-gesamt"),
    ).toHaveTextContent("50,00");
  });

  it("zeigt Name und Reisetag des Programmpunkts", () => {
    zeige();

    expect(zeilen()[0]).toHaveTextContent("Villa Rufolo");
    expect(zeilen()[0]).toHaveTextContent("Tag 2 · So 19.07.");
  });

  /** Zweimal essen kostet zweimal (req-062). */
  it("zeigt denselben POI an zwei Reisetagen in zwei Zeilen", () => {
    zeige({
      activities: [
        programmpunkt({ id: "a1", startAt: "2026-07-19T12:00" }),
        programmpunkt({ id: "a2", startAt: "2026-07-21T12:00" }),
      ],
      pois: [poi({ kostenCent: 1250 })],
    });

    expect(zeilen()).toHaveLength(2);
  });

  it("sagt es, wenn noch keine Kosten erfasst sind", () => {
    zeige({ activities: [] });

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/noch keine Kosten erfasst/i)).toBeInTheDocument();
  });
});
