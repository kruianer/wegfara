import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde } from "@/lib/bewertungen/types";
import { BewertungenView, KEINE_RUNDE_HINWEIS } from "./bewertungen-view";

/**
 * Der Bereich "Bewertungen" des Planers (req-063): der Stand der Runde an
 * einer Stelle. Gezeigt wird die laufende Runde, sonst die zuletzt beendete.
 */

const REISE_ID = "reise-1";

function runde(overrides: Partial<Bewertungsrunde> = {}): Bewertungsrunde {
  return {
    id: "runde-1",
    tripId: REISE_ID,
    status: "laeuft",
    poiIds: ["poi-1"],
    startedAt: "2026-09-07T10:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: REISE_ID,
    number: 1,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.649, lng: 14.612 },
    status: "weiss_nicht",
    ...overrides,
  };
}

function zeige({
  pois = [poi()],
  runden = [runde()],
}: { pois?: Poi[]; runden?: Bewertungsrunde[] } = {}) {
  return render(<BewertungenView pois={pois} runden={runden} />);
}

/** Die Zeilen der Tabelle ohne ihre Kopfzeile. */
function zeilen() {
  return within(screen.getByTestId("bewertungszeilen")).getAllByRole("row");
}

describe("Bereich Bewertungen (req-063)", () => {
  it("traegt seine Ueberschrift", () => {
    zeige();

    expect(
      screen.getByRole("heading", { name: "Bewertungen" }),
    ).toBeInTheDocument();
  });

  /**
   * Ohne Runde ist der Bereich nicht leer, sondern sagt, wo eine entsteht --
   * gestartet wird sie im Bereich POIs, wo die POIs ausgewaehlt werden.
   */
  it("verweist ohne jede Runde auf den Bereich POIs", () => {
    zeige({ runden: [] });

    expect(screen.getByText(KEINE_RUNDE_HINWEIS)).toBeInTheDocument();
    expect(KEINE_RUNDE_HINWEIS).toContain("Bereich POIs");
  });

  it("zeigt den Hinweis nicht, sobald es eine Runde gibt", () => {
    zeige();

    expect(screen.queryByText(KEINE_RUNDE_HINWEIS)).toBeNull();
  });

  it("zeigt zu einer Runde über drei POIs drei Zeilen", () => {
    zeige({
      runden: [runde({ poiIds: ["poi-1", "poi-2", "poi-3"] })],
      pois: [
        poi(),
        poi({ id: "poi-2", name: "Pompeji" }),
        poi({ id: "poi-3", name: "Capri" }),
      ],
    });

    expect(zeilen()).toHaveLength(3);
    for (const name of ["Villa Rufolo", "Pompeji", "Capri"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  /**
   * Der Status beschreibt den Ort, die Stimme die Person (req-054) -- beide
   * stehen in der Zeile, damit der Reiseleiter sie nebeneinander sieht.
   */
  it("zeigt je Zeile den Status des POI", () => {
    zeige({ pois: [poi({ status: "wahrscheinlich" })] });

    expect(zeilen()[0]).toHaveTextContent("Wahrscheinlich");
  });

  it("zeigt POIs, über die nicht abgestimmt wird, gar nicht", () => {
    zeige({
      runden: [runde({ poiIds: ["poi-1"] })],
      pois: [poi(), poi({ id: "poi-2", name: "Pompeji" })],
    });

    expect(zeilen()).toHaveLength(1);
    expect(screen.queryByText("Pompeji")).toBeNull();
  });
});
