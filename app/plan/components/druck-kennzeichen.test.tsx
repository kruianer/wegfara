import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanungView } from "./planung-view";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Das Kennzeichen fuer den gedruckten Reiseplan (req-080) wirkt
 * ausschliesslich auf das Heft. Im Planer bleibt jeder Programmpunkt
 * sichtbar, gleich was dort steht -- es blendet nichts aus, es gestaltet nur
 * den Druck. Die Gegenprobe im Begleiter steht in
 * app/go/druck-kennzeichen.test.tsx.
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

const TODAY = new Date(2026, 6, 10);
const ANREISETAG = "2026-07-18";

const POMPEJI: Poi = {
  id: "poi-pompeji",
  tripId: TRIP.id,
  number: 1,
  name: "Ausgrabungsstätte Pompeji",
  ort: "Pompei",
  type: "sehenswuerdigkeit",
  position: { lat: 40.7489, lng: 14.4989 },
  status: "gesetzt",
};

/** Derselbe Programmpunkt, einmal je Kennzeichen. */
function programmpunkt(
  druckDarstellung: Activity["druckDarstellung"],
): Activity {
  return {
    id: "activity-1",
    tripId: TRIP.id,
    type: "sehenswuerdigkeit",
    title: "Ausgrabungsstätte Pompeji",
    shortText: "",
    longText: "",
    startAt: `${ANREISETAG}T10:00`,
    endAt: `${ANREISETAG}T12:30`,
    poiId: POMPEJI.id,
    druckDarstellung,
  };
}

function zeige(activity: Activity) {
  render(
    <PlanungView
      trip={TRIP}
      pois={[POMPEJI]}
      activities={[activity]}
      transfers={[]}
      today={TODAY}
    />,
  );
}

describe("Kennzeichen fuer den Druck im Planer (req-080)", () => {
  it('laesst einen Programmpunkt mit "Nicht anzeigen" im Zeitstrahl stehen', () => {
    zeige(programmpunkt("nicht_anzeigen"));

    expect(screen.getByTestId("activity-block-activity-1")).toHaveTextContent(
      "Ausgrabungsstätte Pompeji",
    );
  });

  it('laesst auch einen mit "Als Nebenstation" unveraendert stehen', () => {
    zeige(programmpunkt("nebenstation"));

    expect(screen.getByTestId("activity-block-activity-1")).toBeInTheDocument();
  });

  it('haelt den POI dahinter verplant -- "Nicht anzeigen" gibt ihn nicht frei', () => {
    zeige(programmpunkt("nicht_anzeigen"));

    // Waere der Programmpunkt im Planer verschwunden, stuende sein POI
    // wieder unter "Noch unverplant".
    expect(
      screen.queryByTestId(`unplanned-poi-${POMPEJI.id}`),
    ).not.toBeInTheDocument();
  });
});
