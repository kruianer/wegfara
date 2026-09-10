import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ANLEGEZEILE_LABEL, PoiAnlegezeile } from "./poi-anlegezeile";
import type { Poi } from "@/lib/pois/types";
import { runAiPoiSearch } from "@/lib/pois/run-ai-search";
import { GOOGLE_FOTO_PROBLEM_TEXT } from "@/lib/pois/google-foto-problem";
import { AI_SEARCH_FEHLER_TEXT } from "@/lib/pois/ai-search-fehler";
import { GOOGLE_LINK_FAILURE_TEXT } from "@/lib/pois/google-ort";

vi.mock("@/lib/pois/run-ai-search", () => ({
  runAiPoiSearch: vi.fn(),
}));

const mockedRunAiPoiSearch = vi.mocked(runAiPoiSearch);

beforeEach(() => {
  mockedRunAiPoiSearch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
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

function zeile(props: Partial<ComponentProps<typeof PoiAnlegezeile>> = {}) {
  return render(
    <PoiAnlegezeile
      tripId="trip-1"
      hasSearchArea={true}
      hasAiKey={true}
      hasGoogleKey={true}
      onOrtGefunden={() => {}}
      onLeeresFormular={() => {}}
      onPoisAdded={() => {}}
      {...props}
    />,
  );
}

/** Das eine Eingabefeld der Anlegezeile (req-060). */
function feld(): HTMLElement {
  return screen.getByLabelText(ANLEGEZEILE_LABEL);
}

/** Beantwortet die Aufrufe der Schnittstellen nach ihrer Adresse. */
function stubApi(antworten: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    const treffer = Object.entries(antworten).find(([pfad]) =>
      String(url).startsWith(pfad),
    );
    return { ok: Boolean(treffer), json: async () => treffer?.[1] ?? {} };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Das Anlegen sitzt seit req-060 über der Liste statt in ihr: ein einziges
 * Feld nimmt Google-Maps-Link, Suchbegriff und KI-Wunsch an.
 */
describe("PoiAnlegezeile — Google-Maps-Link (req-060, req-048)", () => {
  const LINK = "https://maps.app.goo.gl/aBcD1234";

  const VILLA_RUFOLO = {
    placeId: "ChIJVillaRufolo",
    name: "Villa Rufolo",
    type: "restaurant",
    position: { lat: 40.6491, lng: 14.6113 },
    address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    web: "https://villarufolo.com",
    phone: "+39 089 857621",
    openingHours: "Montag: 09:00–20:00",
    shortText: "Gärten mit Meerblick",
    longText: "Ein Palast aus dem 13. Jahrhundert.",
    bewertung: 4.6,
    bewertungAnzahl: 1240,
    photoNames: ["places/x/photos/a"],
  };

  it("öffnet nach dem Abruf das Formular mit den Angaben des Ortes", async () => {
    const user = userEvent.setup();
    const onOrtGefunden = vi.fn();
    stubApi({
      "/api/ort-aus-link": { result: "gefunden", ort: VILLA_RUFOLO },
    });
    zeile({ onOrtGefunden });

    await user.type(feld(), LINK);

    await waitFor(() => expect(onOrtGefunden).toHaveBeenCalledTimes(1));
    const [{ fuellung, google }] = onOrtGefunden.mock.calls[0];
    expect(fuellung.name).toBe("Villa Rufolo");
    expect(fuellung.type).toBe("restaurant");
    expect(fuellung.address).toBe("Piazza Duomo, 1, 84010 Ravello SA, Italien");
    expect(fuellung.position).toEqual({ lat: 40.6491, lng: 14.6113 });
    // Der Ort bei Google gehört mit — sonst wäre der POI danach keiner mehr.
    expect(google).toEqual({
      placeId: "ChIJVillaRufolo",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      photoNames: ["places/x/photos/a"],
    });
  });

  it("leert das Feld und sagt, welcher Ort übernommen wurde", async () => {
    const user = userEvent.setup();
    stubApi({
      "/api/ort-aus-link": { result: "gefunden", ort: VILLA_RUFOLO },
    });
    zeile();

    await user.type(feld(), LINK);

    expect(
      await screen.findByTestId("anlegezeile-uebernommen"),
    ).toHaveTextContent("Villa Rufolo");
    expect(feld()).toHaveValue("");
  });

  it("nennt den Grund, wenn der Abruf fehlschlägt, und öffnet kein Formular", async () => {
    const user = userEvent.setup();
    const onOrtGefunden = vi.fn();
    stubApi({
      "/api/ort-aus-link": {
        result: "fehler",
        reason: "ort_nicht_gefunden",
      },
    });
    zeile({ onOrtGefunden });

    await user.type(feld(), LINK);

    expect(await screen.findByTestId("anlegezeile-fehler")).toHaveTextContent(
      GOOGLE_LINK_FAILURE_TEXT.ort_nicht_gefunden,
    );
    expect(onOrtGefunden).not.toHaveBeenCalled();
  });

  it("ruft ohne Google-Schlüssel nichts ab und nennt den Grund", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ "/api/ort-aus-link": {} });
    zeile({ hasGoogleKey: false });

    await user.type(feld(), LINK);

    expect(
      await screen.findByTestId("anlegezeile-kein-schluessel"),
    ).toHaveTextContent("Zugangsschlüssel");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("weist eine Webadresse ab, die kein Google-Maps-Link ist", async () => {
    const user = userEvent.setup();
    zeile();

    await user.type(feld(), "https://example.com/villa");

    expect(await screen.findByTestId("anlegezeile-fehler")).toHaveTextContent(
      GOOGLE_LINK_FAILURE_TEXT.kein_google_link,
    );
  });
});

describe("PoiAnlegezeile — Suchbegriff (req-060, req-048)", () => {
  function stubPlaceSearch() {
    return stubApi({
      "/api/place-search": {
        places: [
          {
            name: "Villa Rufolo",
            context: "Kampanien, Italien",
            lat: 40.6465,
            lng: 14.6127,
            address: "Via Santa Chiara 26, 84010 Ravello, Italien",
            art: "tourism/attraction",
          },
        ],
      },
    });
  }

  it("öffnet mit einem gewählten Vorschlag das Formular für diesen Ort", async () => {
    const user = userEvent.setup();
    const onOrtGefunden = vi.fn();
    stubPlaceSearch();
    zeile({ onOrtGefunden });

    await user.type(feld(), "Villa Rufolo");
    await user.click(await screen.findByText("Villa Rufolo"));

    expect(onOrtGefunden).toHaveBeenCalledTimes(1);
    const [{ fuellung, google }] = onOrtGefunden.mock.calls[0];
    expect(fuellung.name).toBe("Villa Rufolo");
    expect(fuellung.position).toEqual({ lat: 40.6465, lng: 14.6127 });
    expect(fuellung.address).toBe(
      "Via Santa Chiara 26, 84010 Ravello, Italien",
    );
    // Ein Vorschlag von OpenStreetMap kennt keinen Ort bei Google.
    expect(google).toBeNull();
  });

  it("leert das Feld mit dem gewählten Vorschlag", async () => {
    const user = userEvent.setup();
    stubPlaceSearch();
    zeile();

    await user.type(feld(), "Villa Rufolo");
    await user.click(await screen.findByText("Villa Rufolo"));

    expect(feld()).toHaveValue("");
    expect(screen.queryByLabelText("Ortsvorschläge")).not.toBeInTheDocument();
  });

  it("sucht nach einem Begriff auch ohne Zugangsschlüssel", async () => {
    const user = userEvent.setup();
    stubPlaceSearch();
    zeile({ hasAiKey: false, hasGoogleKey: false });

    await user.type(feld(), "Villa Rufolo");

    expect(await screen.findByText("Villa Rufolo")).toBeInTheDocument();
  });
});

describe("PoiAnlegezeile — KI-Suche nur auf Knopfdruck (req-060, req-014)", () => {
  it("versteht den getippten Text als Wunsch und legt die gefundenen POIs an", async () => {
    const user = userEvent.setup();
    const onPoisAdded = vi.fn();
    stubApi({ "/api/place-search": { places: [] } });
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 3,
      discardedCount: 2,
      createdPois: [newPoi()],
      fotoProblem: null,
      fehler: null,
    });
    zeile({ onPoisAdded });

    await user.type(feld(), "ruhige Strände");
    await user.click(screen.getByRole("button", { name: "Mit KI suchen" }));

    expect(mockedRunAiPoiSearch).toHaveBeenCalledWith(
      "trip-1",
      "alle",
      "ruhige Strände",
    );
    expect(onPoisAdded).toHaveBeenCalledWith([newPoi()]);
    expect(screen.getByTestId("ai-search-result")).toHaveTextContent(
      "3 neue POIs angelegt, 2 Vorschläge verworfen.",
    );
  });

  it("löst ohne Knopfdruck keine KI-Suche aus", async () => {
    const user = userEvent.setup();
    stubApi({ "/api/place-search": { places: [] } });
    zeile();

    await user.type(feld(), "ruhige Strände");
    // Lange genug, dass die Ortssuche längst gelaufen wäre.
    await waitFor(() =>
      expect(screen.queryByLabelText("Ortsvorschläge")).not.toBeInTheDocument(),
    );

    expect(mockedRunAiPoiSearch).not.toHaveBeenCalled();
  });

  it("ist ohne Suchgebiet nicht bedienbar und nennt den Grund", () => {
    zeile({ hasSearchArea: false });

    expect(
      screen.getByRole("button", { name: "Mit KI suchen" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Für „Mit KI suchen“ zuerst ein Suchgebiet auf der Karte zeichnen.",
      ),
    ).toBeInTheDocument();
  });

  /**
   * Ohne hinterlegten Zugangsschluessel ist die Suche gesperrt (req-028) --
   * auch dann, wenn ein Suchgebiet gezeichnet ist.
   */
  it("ist ohne Zugangsschlüssel nicht bedienbar und nennt den Grund", async () => {
    const user = userEvent.setup();
    zeile({ hasAiKey: false });

    const knopf = screen.getByRole("button", { name: "Mit KI suchen" });
    expect(knopf).toBeDisabled();
    const hinweis = screen.getByTestId("ai-search-kein-schluessel");
    expect(hinweis).toHaveTextContent("Zugangsschlüssel");
    expect(hinweis).toHaveTextContent("Mein Bereich");

    await user.click(knopf);
    expect(mockedRunAiPoiSearch).not.toHaveBeenCalled();
  });

  /**
   * Seit req-057 werden die vorgeschlagenen Orte bei Google nachgeschlagen
   * -- ohne dessen Schluessel gaebe es weder Foto noch Bewertung, und die
   * Suche laeuft gar nicht erst.
   */
  it("ist ohne Google-Schlüssel nicht bedienbar und nennt den Grund (req-057)", async () => {
    const user = userEvent.setup();
    zeile({ hasGoogleKey: false });

    const knopf = screen.getByRole("button", { name: "Mit KI suchen" });
    expect(knopf).toBeDisabled();
    expect(screen.getByTestId("ai-search-kein-schluessel")).toHaveTextContent(
      "Import aus Google",
    );

    await user.click(knopf);
    expect(mockedRunAiPoiSearch).not.toHaveBeenCalled();
  });

  it("sperrt die Schaltfläche während der Suche und löst keine zweite aus", async () => {
    const user = userEvent.setup();
    let resolveSearch: (
      value: Awaited<ReturnType<typeof runAiPoiSearch>>,
    ) => void;
    mockedRunAiPoiSearch.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    zeile();

    await user.click(screen.getByRole("button", { name: "Mit KI suchen" }));

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
  it("nennt den Grund, wenn die Suche fehlschlägt, und meldet keine POIs", async () => {
    const user = userEvent.setup();
    const onPoisAdded = vi.fn();
    mockedRunAiPoiSearch.mockResolvedValue({
      addedCount: 0,
      discardedCount: 0,
      createdPois: [],
      fotoProblem: null,
      fehler: { art: "modell", detail: "you must provide a model parameter" },
    });
    zeile({ onPoisAdded });

    await user.click(screen.getByRole("button", { name: "Mit KI suchen" }));

    const meldung = await screen.findByTestId("ai-search-error");
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
    zeile();

    await user.click(screen.getByRole("button", { name: "Mit KI suchen" }));

    expect(await screen.findByTestId("ai-search-error")).toHaveTextContent(
      "Nicht der Zugangsschlüssel ist die Ursache",
    );
  });
});

describe("PoiAnlegezeile — Bilder, die nicht ankamen (bug-027)", () => {
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
    zeile({ onPoisAdded });

    await user.click(screen.getByRole("button", { name: "Mit KI suchen" }));

    expect(await screen.findByTestId("ai-search-fotos")).toHaveTextContent(
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
    zeile();

    await user.click(screen.getByRole("button", { name: "Mit KI suchen" }));

    expect(await screen.findByTestId("ai-search-result")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-search-fotos")).not.toBeInTheDocument();
  });
});

describe("PoiAnlegezeile — leeres Formular (req-035)", () => {
  it("führt weiterhin zum leeren Formular", async () => {
    const user = userEvent.setup();
    const onLeeresFormular = vi.fn();
    zeile({ onLeeresFormular });

    await user.click(screen.getByRole("button", { name: "POI anlegen" }));

    expect(onLeeresFormular).toHaveBeenCalled();
  });

  it("bietet es nicht doppelt an, solange eines offen steht", () => {
    zeile({ anlegenOffen: true });

    expect(screen.getByRole("button", { name: "POI anlegen" })).toBeDisabled();
  });
});
