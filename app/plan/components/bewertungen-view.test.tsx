import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Bewertungsrunde } from "@/lib/bewertungen/types";
import { BewertungenView, KEINE_RUNDE_HINWEIS } from "./bewertungen-view";

/**
 * Der Bereich "Bewertungen" des Planers (req-063): der Stand der Runde an
 * einer Stelle. Gezeigt wird die laufende Runde, sonst die zuletzt beendete.
 */

function runde(overrides: Partial<Bewertungsrunde> = {}): Bewertungsrunde {
  return {
    id: "runde-1",
    tripId: "reise-1",
    status: "laeuft",
    poiIds: ["poi-1"],
    startedAt: "2026-09-07T10:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

function zeige({ runden = [runde()] }: { runden?: Bewertungsrunde[] } = {}) {
  return render(<BewertungenView runden={runden} />);
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
});
