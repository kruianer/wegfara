import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiPoiSearch } from "./ai-poi-search";
import type { Poi } from "@/lib/pois/types";
import { runAiPoiSearch } from "@/lib/pois/run-ai-search";
import { GOOGLE_FOTO_PROBLEM_TEXT } from "@/lib/pois/google-foto-problem";
import { AI_SEARCH_FEHLER_TEXT } from "@/lib/pois/ai-search-fehler";

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
        hasGoogleKey={true}
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
        hasGoogleKey={true}
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

  /**
   * Seit req-057 werden die vorgeschlagenen Orte bei Google nachgeschlagen
   * -- ohne dessen Schluessel gaebe es weder Foto noch Bewertung, und die
   * Suche laeuft gar nicht erst.
   */
  it("ist ohne Google-Schlüssel nicht bedienbar und nennt den Grund (req-057)", async () => {
    const user = userEvent.setup();
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasApiKey={true}
        hasGoogleKey={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    ).toBeDisabled();
    expect(screen.getByTestId("ai-search-kein-schluessel")).toHaveTextContent(
      "Import aus Google",
    );

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
      fotoProblem: null,
      fehler: null,
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="restaurant"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasApiKey={true}
        hasGoogleKey={true}
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
      fotoProblem: null,
      fehler: null,
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={onPoisAdded}
        hasApiKey={true}
        hasGoogleKey={true}
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
        hasGoogleKey={true}
      />,
    );

    const button = screen.getByRole("button", { name: "POIs per KI suchen" });
    await user.click(button);

    expect(screen.getByRole("button", { name: "Sucht…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Sucht…" }));

    expect(mockedRunAiPoiSearch).toHaveBeenCalledTimes(1);

    resolveSearch!({
      addedCount: 0,
      discardedCount: 0,
      createdPois: [],
      fotoProblem: null,
      fehler: null,
    });
  });

  /**
   * Der Fehlschlag wird benannt (bug-032): ein blosses "Fehler" schickte den
   * Nutzer auf die Suche nach seinem Zugangsschluessel, obwohl in Wahrheit
   * der Modellname fehlte (vgl. bug-021, bug-026).
   */
  it("nennt den Grund, wenn die Suche fehlschlaegt, und meldet keine POIs", async () => {
    const user = userEvent.setup();
    const onPoisAdded = vi.fn();
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 0,
      discardedCount: 0,
      createdPois: [],
      fotoProblem: null,
      fehler: {
        art: "modell",
        detail: "you must provide a model parameter",
      },
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={onPoisAdded}
        hasApiKey={true}
        hasGoogleKey={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );

    const meldung = screen.getByTestId("ai-search-error");
    expect(meldung).toHaveTextContent(AI_SEARCH_FEHLER_TEXT.modell);
    expect(meldung).toHaveTextContent("you must provide a model parameter");
    expect(onPoisAdded).not.toHaveBeenCalled();
  });

  it("schickt bei einem anderen Grund als dem Schlüssel niemanden zum Schlüssel", async () => {
    const user = userEvent.setup();
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 0,
      discardedCount: 0,
      createdPois: [],
      fotoProblem: null,
      fehler: { art: "region", detail: "" },
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasApiKey={true}
        hasGoogleKey={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );

    expect(screen.getByTestId("ai-search-error")).toHaveTextContent(
      "Nicht der Zugangsschlüssel ist die Ursache",
    );
  });
});

describe("AiPoiSearch — Bilder, die nicht ankamen (bug-027)", () => {
  it("nennt den Grund und meldet die POIs trotzdem", async () => {
    const user = userEvent.setup();
    const onPoisAdded = vi.fn();
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 1,
      discardedCount: 0,
      createdPois: [newPoi()],
      fotoProblem: "ablage_fehlt",
      fehler: null,
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={onPoisAdded}
        hasApiKey={true}
        hasGoogleKey={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );

    expect(screen.getByTestId("ai-search-fotos")).toHaveTextContent(
      GOOGLE_FOTO_PROBLEM_TEXT.ablage_fehlt,
    );
    expect(onPoisAdded).toHaveBeenCalledWith([newPoi()]);
  });

  it("schweigt, solange die Bilder ankommen", async () => {
    const user = userEvent.setup();
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 1,
      discardedCount: 0,
      createdPois: [newPoi()],
      fotoProblem: null,
      fehler: null,
    });
    render(
      <AiPoiSearch
        tripId="trip-1"
        typeFilter="alle"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasApiKey={true}
        hasGoogleKey={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    );

    expect(screen.getByTestId("ai-search-result")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-search-fotos")).not.toBeInTheDocument();
  });
});
