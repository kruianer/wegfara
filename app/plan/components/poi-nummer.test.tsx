import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PoiMap } from "./poi-map";
import { PoiList } from "./poi-list";
import { PlanungView } from "./planung-view";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { Trip } from "@/lib/trips/types";
import { POI_STATUSES } from "@/lib/pois/status-meta";
import { VORGEWAEHLTE_LISTEN_EINSTELLUNGEN } from "@/lib/pois/ansicht-einstellungen";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Es ist eine Nummer, nicht fuenf (req-074, bug-055): dieselbe Zahl steht auf
 * dem Marker der POI-Karte, in der POI-Liste (req-013), in der Auswahlliste
 * "Noch unverplant", am Programmpunkt des Zeitstrahls und auf dem Wegpunkt der
 * Tageskarte. Der Test vergleicht alle fuenf Stellen am selben POI -- laeuft
 * eine davon auf eine eigene Zaehlung hinaus, faellt es hier auf.
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

const POI: Poi = {
  id: "poi-pompeji",
  tripId: TRIP.id,
  number: 14,
  name: "Ausgrabungsstätte Pompeji",
  ort: "Pompei",
  type: "sehenswuerdigkeit",
  position: { lat: 40.7489, lng: 14.4989 },
  status: "gesetzt",
};

/** Derselbe POI, verplant: der Programmpunkt kennt ihn ueber `poiId`. */
const PROGRAMMPUNKT: Activity = {
  id: "activity-1",
  tripId: TRIP.id,
  type: "sehenswuerdigkeit",
  title: POI.name,
  shortText: "",
  longText: "",
  startAt: `${ANREISETAG}T10:00`,
  endAt: `${ANREISETAG}T12:30`,
  poiId: POI.id,
  // Ohne Position liegt er nicht auf der Tageskarte -- dort wird die fuenfte
  // Stelle geprueft (bug-055).
  position: POI.position,
};

/** Die Zahl aus einer Beschriftung -- "#14" auf der Karte wie "14" am Marker. */
function zahl(testId: string): string {
  return (screen.getByTestId(testId).textContent ?? "").replace(/\D/g, "");
}

/** Der Marker zeichnet sich erst, wenn die Karte bereit ist (siehe poi-map.test.tsx). */
async function flushMapReady() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

/** Die POI-Liste, wie der Planer sie stellt (siehe poi-list.test.tsx). */
function PoiListe({ pois }: { pois: Poi[] }) {
  const [listenEinstellungen, setListenEinstellungen] = useState(
    VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
  );

  return (
    <PoiList
      pois={pois}
      highlightedPoiId={null}
      onStatusChange={() => {}}
      tripId={TRIP.id}
      hasSearchArea={true}
      onPoisAdded={() => {}}
      listenEinstellungen={listenEinstellungen}
      onListenEinstellungenChange={setListenEinstellungen}
    />
  );
}

/** Die Planung -- zur Anzeige, ohne Verplanen (dafuer planung-view.test.tsx). */
function Planung({ activities }: { activities: Activity[] }) {
  return (
    <PlanungView
      trip={TRIP}
      pois={[POI]}
      activities={activities}
      transfers={[]}
      today={TODAY}
    />
  );
}

describe("Dieselbe POI-Nummer an allen fuenf Stellen (req-074, bug-055)", () => {
  it("zeigt auf POI-Karte, in POI-Liste, Auswahlliste, Zeitstrahl und Tageskarte dieselbe Zahl", async () => {
    const gesehen: Record<string, string> = {};

    const karte = render(
      <PoiMap
        tripId={TRIP.id}
        pois={[POI]}
        mainPlace={TRIP.mainPlace}
        visibleStatuses={POI_STATUSES}
        onToggleStatus={() => {}}
        onSelectPoi={() => {}}
        searchArea={null}
        onSearchAreaChange={() => {}}
        pickingPosition={false}
        pickingLabel={null}
      />,
    );
    await flushMapReady();
    gesehen.kartenmarker = zahl(`poi-marker-number-${POI.id}`);
    karte.unmount();

    const liste = render(<PoiListe pois={[POI]} />);
    gesehen.poiListe = zahl(`poi-number-${POI.id}`);
    liste.unmount();

    // Noch unverplant: der POI liegt in der Auswahlliste.
    const auswahl = render(<Planung activities={[]} />);
    gesehen.auswahlliste = zahl(`unplanned-poi-number-${POI.id}`);
    auswahl.unmount();

    // Verplant: derselbe POI steht jetzt als Programmpunkt im Zeitstrahl und
    // als Wegpunkt auf der Tageskarte daneben.
    render(<Planung activities={[PROGRAMMPUNKT]} />);
    await flushMapReady();
    gesehen.zeitstrahl = zahl(`activity-number-${PROGRAMMPUNKT.id}`);
    gesehen.tageskarte = zahl(`waypoint-marker-${PROGRAMMPUNKT.id}`);

    expect(gesehen).toEqual({
      kartenmarker: "14",
      poiListe: "14",
      auswahlliste: "14",
      zeitstrahl: "14",
      tageskarte: "14",
    });
  });
});
