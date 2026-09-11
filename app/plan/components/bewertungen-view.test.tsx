import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Poi } from "@/lib/pois/types";
import type {
  Bewertungsrunde,
  Stimme,
  StimmWahl,
} from "@/lib/bewertungen/types";
import type { BewertendePerson } from "@/lib/bewertungen/stand";
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

/** Die vier Teilnehmer der Reise -- auch wer nicht gestimmt hat, zaehlt mit. */
const PERSONEN: BewertendePerson[] = [
  { id: "anna", name: "Anna" },
  { id: "bert", name: "Bert" },
  { id: "clara", name: "Clara" },
  { id: "dirk", name: "Dirk" },
];

function stimme(
  participantId: string,
  wahl: StimmWahl,
  poiId = "poi-1",
  roundId = "runde-1",
): Stimme {
  return { roundId, poiId, participantId, wahl };
}

function zeige({
  pois = [poi()],
  runden = [runde()],
  stimmen = [],
  personen = PERSONEN,
}: {
  pois?: Poi[];
  runden?: Bewertungsrunde[];
  stimmen?: Stimme[];
  personen?: BewertendePerson[];
} = {}) {
  return render(
    <BewertungenView
      pois={pois}
      runden={runden}
      stimmen={stimmen}
      personen={personen}
    />,
  );
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

  it("zeigt die Stimmen je Stufe als Zahl", () => {
    zeige({
      stimmen: [stimme("anna", "unbedingt"), stimme("bert", "unbedingt")],
    });

    expect(
      screen.getByLabelText("Will ich unbedingt: Villa Rufolo"),
    ).toHaveTextContent("2");
    expect(screen.getByLabelText("Wäre schön: Villa Rufolo")).toHaveTextContent(
      "0",
    );
  });

  it("nennt alle fünf Stufen, auch die ohne Stimme", () => {
    zeige({ stimmen: [stimme("anna", "unbedingt")] });

    for (const label of [
      "Will ich unbedingt",
      "Wäre schön",
      "Wenn wir Zeit haben",
      "Lieber nicht",
      "Ohne mich",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("zeigt, wie viele noch nicht gestimmt haben", () => {
    zeige({
      stimmen: [stimme("anna", "unbedingt"), stimme("bert", "lieber_nicht")],
    });

    expect(
      screen.getByLabelText("Noch nicht gestimmt: Villa Rufolo"),
    ).toHaveTextContent("2");
  });

  it("zählt nur die Stimmen dieses POI", () => {
    zeige({
      runden: [runde({ poiIds: ["poi-1", "poi-2"] })],
      pois: [poi(), poi({ id: "poi-2", name: "Pompeji" })],
      stimmen: [
        stimme("anna", "unbedingt"),
        stimme("bert", "unbedingt", "poi-2"),
      ],
    });

    expect(
      screen.getByLabelText("Will ich unbedingt: Villa Rufolo"),
    ).toHaveTextContent("1");
    expect(
      screen.getByLabelText("Noch nicht gestimmt: Pompeji"),
    ).toHaveTextContent("3");
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
