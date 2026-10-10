import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Trip } from "@/lib/trips/types";
import type { Activity } from "@/lib/activities/types";
import { GoView } from "./go-view";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Das Kennzeichen fuer den gedruckten Reiseplan (req-080) wirkt
 * ausschliesslich auf das Heft. Im Begleiter bleibt jeder Programmpunkt
 * sichtbar, gleich was dort steht -- wer unterwegs ist, soll den Kaffee auf
 * dem Weg nicht verlieren, nur weil er im Heft klein oder gar nicht steht.
 * Die Gegenprobe im Planer steht in
 * app/plan/components/druck-kennzeichen.test.tsx.
 */

const TODAY = "2026-07-20";

const REISE: Trip = {
  id: "trip-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "freigegeben",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

function programmpunkt(
  druckDarstellung: Activity["druckDarstellung"],
): Activity {
  return {
    id: "activity-1",
    tripId: REISE.id,
    type: "restaurant",
    title: "Caffè Vittoria",
    shortText: "Kaffee auf dem Weg.",
    longText: "Eine halbe Stunde Kaffee, damit die Fahrt nicht durchgeht.",
    startAt: `${TODAY}T10:15`,
    endAt: `${TODAY}T10:45`,
    position: { lat: 40.634, lng: 14.6027 },
    druckDarstellung,
  };
}

describe("Kennzeichen fuer den Druck im Begleiter (req-080)", () => {
  it('zeigt einen Programmpunkt mit "Nicht anzeigen" unveraendert', () => {
    render(
      <GoView
        trips={[REISE]}
        activities={[programmpunkt("nicht_anzeigen")]}
        today={TODAY}
      />,
    );

    // Die Kachel des Programmpunkts steht im Zeitstrahl des Tages -- mit
    // Namen und Uhrzeit, wie jede andere.
    const kopf = screen.getByTestId("kachel-kopf-activity-1");
    expect(kopf).toHaveTextContent("10:15");
    expect(kopf.parentElement).toHaveTextContent("Caffè Vittoria");
  });

  it('zeigt auch einen mit "Als Nebenstation" unveraendert', () => {
    render(
      <GoView
        trips={[REISE]}
        activities={[programmpunkt("nebenstation")]}
        today={TODAY}
      />,
    );

    expect(
      screen.getByTestId("kachel-kopf-activity-1").parentElement,
    ).toHaveTextContent("Caffè Vittoria");
  });
});
