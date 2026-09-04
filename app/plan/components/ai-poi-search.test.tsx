import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiPoiSearch } from "./ai-poi-search";
import type { Poi } from "@/lib/pois/types";
import { runAiPoiSearch } from "@/lib/pois/run-ai-search";

vi.mock("@/lib/pois/run-ai-search", () => ({
  runAiPoiSearch: vi.fn(),
}));

const mockedRunAiPoiSearch = vi.mocked(runAiPoiSearch);

beforeEach(() => {
  mockedRunAiPoiSearch.mockReset();
});

function newPoi(): Poi {
  return {
    id: "new-1",
    tripId: "trip-1",
    number: 13,
    name: "Trulli di Alberobello",
    ort: "Alberobello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.78, lng: 17.24 },
    status: "weiss_nicht",
  };
}

describe("AiPoiSearch", () => {
  it("ist ohne Suchgebiet nicht bedienbar und nennt den Grund", () => {
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={false}
        onPoisAdded={() => {}}
        hasApiKey={true}
      />,
    );

    expect(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Zuerst ein Suchgebiet auf der Karte zeichnen."),
    ).toBeInTheDocument();
  });

  /**
   * Ohne hinterlegten Zugangsschluessel ist die Suche gesperrt (req-028) --
   * auch dann, wenn ein Suchgebiet gezeichnet ist.
   */
  it("ist ohne Zugangsschlüssel nicht bedienbar und nennt den Grund", async () => {
    const user = userEvent.setup();
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasApiKey={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: "Wunsch für die POI-Suche" }),
    ).toBeDisabled();
    const hinweis = screen.getByTestId("ai-search-kein-schluessel");
    expect(hinweis).toHaveTextContent("Zugangsschlüssel");
    expect(hinweis).toHaveTextContent("Mein Bereich");

    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );
    expect(mockedRunAiPoiSearch).not.toHaveBeenCalled();
  });

  it("loest bei vorhandenem Suchgebiet eine Suche mit Typfilter und Wunsch aus", async () => {
    const user = userEvent.setup();
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 1,
      discardedCount: 0,
      createdPois: [newPoi()],
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="restaurant"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasApiKey={true}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "Wunsch für die POI-Suche" }),
      "mit Kindern",
    );
    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );

    expect(mockedRunAiPoiSearch).toHaveBeenCalledWith(
      "trip-1",
      "restaurant",
      "mit Kindern",
    );
  });

  it("meldet die neu angelegten POIs und zeigt die Ergebniszeile", async () => {
    const user = userEvent.setup();
    const onPoisAdded = vi.fn();
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 3,
      discardedCount: 2,
      createdPois: [newPoi()],
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={onPoisAdded}
        hasApiKey={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );

    expect(onPoisAdded).toHaveBeenCalledWith([newPoi()]);
    expect(screen.getByTestId("ai-search-result")).toHaveTextContent(
      "3 neue POIs angelegt, 2 Vorschläge verworfen.",
    );
  });

  it("sperrt die Schaltfläche waehrend der Suche und loest keine zweite Suche aus", async () => {
    const user = userEvent.setup();
    let resolveSearch: (
      value: Awaited<ReturnType<typeof runAiPoiSearch>>,
    ) => void;
    mockedRunAiPoiSearch.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasApiKey={true}
      />,
    );

    const button = screen.getByRole("button", { name: "POIs per KI suchen" });
    await user.click(button);

    expect(screen.getByRole("button", { name: "Sucht…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Sucht…" }));

    expect(mockedRunAiPoiSearch).toHaveBeenCalledTimes(1);

    resolveSearch!({ addedCount: 0, discardedCount: 0, createdPois: [] });
  });

  it("zeigt einen Hinweis, wenn die Suche fehlschlaegt, und meldet keine POIs", async () => {
    const user = userEvent.setup();
    const onPoisAdded = vi.fn();
    mockedRunAiPoiSearch.mockResolvedValue(null);
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={onPoisAdded}
        hasApiKey={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );

    expect(screen.getByTestId("ai-search-error")).toBeInTheDocument();
    expect(onPoisAdded).not.toHaveBeenCalled();
  });
});
