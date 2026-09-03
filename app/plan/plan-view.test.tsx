import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanView } from "./plan-view";
import type { Poi } from "@/lib/pois/types";
import { TRIP_ERRORS } from "@/lib/trips/validate";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";
import { DEMO_POIS } from "@/tests/fixtures/demo-pois";
import { DEMO_ACTIVITIES } from "@/tests/fixtures/demo-activities";
import { DEMO_TRANSFERS } from "@/tests/fixtures/demo-transfers";
import { MapLibreMap, Marker } from "@/tests/mocks/maplibre-gl";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const TODAY = "2026-07-20";

// Die Kartenansicht wartet nach dem Mounten einen Frame ab, bevor sie
// Groesse und Marker anlegt (siehe app/plan/components/poi-map.tsx, bug-003).
async function flushMapReady() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe("PlanView", () => {
  beforeEach(() => {
    setWindowWidth(1440);
  });

  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it('zeigt die Wortmarke "Wegfara" im Kopfbereich', () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(
      within(screen.getByRole("banner")).getByText("Wegfara"),
    ).toBeInTheDocument();
  });

  it("zeigt genau sechs Bereichsschaltflächen", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(within(nav).getAllByRole("button")).toHaveLength(6);
  });

  it('hebt "POIs" als aktiven Bereich hervor', () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(screen.getByRole("button", { name: "POIs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("zeigt die laufende Reise im Kopfbereich", () => {
    render(<PlanView trips={DEMO_TRIPS} today="2026-10-10" />);

    expect(screen.getByRole("banner")).toHaveTextContent("Wien Städtereise");
  });

  it("öffnet beim Klick auf den Reisenamen eine Liste mit genau drei Reisen", async () => {
    const user = userEvent.setup();
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));

    const dialog = screen.getByRole("dialog", { name: "Reise wählen" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
  });

  it('zeigt "Süditalien Rundreise" im Kopfbereich nach Auswahl in der Reiseliste', async () => {
    const user = userEvent.setup();
    render(<PlanView trips={DEMO_TRIPS} today="2026-10-10" />);

    await user.click(screen.getByText("Wien Städtereise"));
    const dialog = screen.getByRole("dialog", { name: "Reise wählen" });
    await user.click(within(dialog).getByText("Süditalien Rundreise"));

    expect(screen.getByRole("banner")).toHaveTextContent(
      "Süditalien Rundreise",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("verbreitert die linke Fläche beim Ziehen des Trenners um 200 Pixel", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    const leftPane = screen.getByTestId("split-pane-left");
    const initialWidth = parseFloat(leftPane.style.width);
    const separator = screen.getByRole("separator", {
      name: "Spaltenbreite anpassen",
    });

    fireEvent.mouseDown(separator, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 200 });
    fireEvent.mouseUp(window);

    expect(parseFloat(leftPane.style.width)).toBe(initialWidth + 200);
  });

  it("klappt die linke Spalte weg und wieder ein", () => {
    // Zum Zeichnen des Suchgebiets braucht die Karte die ganze Breite
    // (bug-011).
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(screen.getByTestId("split-pane-left")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Liste ausblenden" }));
    expect(screen.queryByTestId("split-pane-left")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Liste einblenden" }));
    expect(screen.getByTestId("split-pane-left")).toBeInTheDocument();
  });

  it("zeigt bei einem 800 Pixel breiten Fenster einen Hinweis auf die benötigte Bildschirmbreite", () => {
    setWindowWidth(800);
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(screen.getByText(/breiteren Bildschirm/i)).toBeInTheDocument();
    expect(screen.getByText("Begleiter")).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it('wechselt beim Klick auf "Kosten" die Ansicht nicht', async () => {
    const user = userEvent.setup();
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByRole("button", { name: "Kosten" }));

    expect(screen.getByRole("button", { name: "POIs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("split-pane-left")).toBeInTheDocument();
  });

  it("zeigt im Kopfbereich keine Teilnehmer-Avatare", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(
      within(screen.getByRole("banner")).queryAllByRole("img"),
    ).toHaveLength(0);
  });

  describe("Bereich POIs (req-010)", () => {
    it("zeigt fuer die Suditalien Rundreise mit zwoelf POIs zwoelf Zeilen", () => {
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);

      expect(screen.getAllByRole("listitem")).toHaveLength(12);
    });

    it('zeigt im Listenkopf "12 von 12"', () => {
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);

      expect(screen.getByText("12 von 12")).toBeInTheDocument();
    });

    it("schraenkt die Liste beim Waehlen von Restaurant in der Filterleiste ein", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);

      await user.click(screen.getByRole("button", { name: "Restaurant" }));

      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(screen.getByText("Trattoria da Nennella")).toBeInTheDocument();
    });

    it("faerbt den Statuspunkt gruen, nachdem der Status auf Gesetzt geaendert wurde", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);

      const villaRufolo = DEMO_POIS.find((p) => p.name === "Villa Rufolo")!;
      expect(villaRufolo.status).toBe("weiss_nicht");

      await user.selectOptions(
        screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
        "Gesetzt",
      );

      expect(
        screen.getByTestId(`poi-status-dot-${villaRufolo.id}`),
      ).toHaveStyle({ background: "rgb(143, 214, 164)" });
    });

    it("zeigt auf der Karte standardmaessig nur POIs mit Status Gesetzt oder Wahrscheinlich", async () => {
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);

      await flushMapReady();

      // Suditalien Rundreise: 3x gesetzt, 4x wahrscheinlich (siehe
      // tests/fixtures/demo-pois.ts).
      expect(
        MapLibreMap.instances.at(-1)!.getContainer().querySelectorAll("button")
          .length,
      ).toBe(7);
    });

    it("hebt beim Anklicken eines Kartenmarkers den zugehoerigen POI in der Liste hervor", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      const nennella = DEMO_POIS.find(
        (p) => p.name === "Trattoria da Nennella",
      )!;
      expect(nennella.status).toBe("wahrscheinlich");
      const marker = screen.getByRole("button", {
        name: new RegExp(`^${nennella.name} ·`),
      });
      await user.click(marker);

      expect(screen.getByTestId(`poi-row-${nennella.id}`).className).toMatch(
        /rowHighlighted/,
      );
    });

    it("zeigt einen zugeschalteten Status zusaetzlich auf der Karte", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      await user.click(screen.getByRole("switch", { name: "Auf keinen Fall" }));

      // 7 (Standard) + 1 POI mit Status "Auf keinen Fall" (Barock-Altstadt).
      expect(
        MapLibreMap.instances.at(-1)!.getContainer().querySelectorAll("button")
          .length,
      ).toBe(8);
    });

    it("behaelt einen zugeschalteten Status beim Wechsel des Planer-Bereichs und zurueck", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      await user.click(screen.getByRole("switch", { name: "Weiß noch nicht" }));
      await user.click(screen.getByRole("button", { name: "Planung" }));
      await user.click(screen.getByRole("button", { name: "POIs" }));
      await flushMapReady();

      expect(
        screen.getByRole("switch", { name: "Weiß noch nicht" }),
      ).toBeChecked();
    });

    it("wirkt der Kartenfilter zusaetzlich zum Typfilter der Liste", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      await user.click(screen.getByRole("button", { name: "Restaurant" }));
      await flushMapReady();

      // Trattoria da Nennella ist der einzige Restaurant-POI mit Status
      // Gesetzt/Wahrscheinlich.
      expect(
        MapLibreMap.instances.at(-1)!.getContainer().querySelectorAll("button")
          .length,
      ).toBe(1);
    });
  });

  describe("Suchgebiet (req-012)", () => {
    const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

    function squarePoints(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        lat: 40.8 + i * 0.01,
        lng: 14.2 + i * 0.01,
      }));
    }

    async function clickMapAt(point: { lat: number; lng: number }) {
      await act(async () => {
        MapLibreMap.instances.at(-1)!.simulateClick([point.lng, point.lat]);
      });
    }

    async function drawArea(
      user: ReturnType<typeof userEvent.setup>,
      points: { lat: number; lng: number }[],
    ) {
      await user.click(
        screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
      );
      for (const point of points) {
        await clickMapAt(point);
      }
      await user.click(
        screen.getByRole("button", { name: "Suchgebiet schließen" }),
      );
    }

    function searchAreaRing() {
      return (
        MapLibreMap.instances.at(-1)!.getSource("search-area")?.data.features[0]
          ?.geometry as GeoJSON.Polygon | undefined
      )?.coordinates[0];
    }

    it("zeigt nach dem Zeichnen von vier Punkten und Schliessen eine Flaeche mit vier Ecken", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true })),
      );
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      await drawArea(user, squarePoints(4));

      expect(searchAreaRing()).toHaveLength(5);
    });

    it("meldet das neu gezeichnete Suchgebiet an den Server", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn(async () => ({ ok: true }));
      vi.stubGlobal("fetch", fetchMock);
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      const points = squarePoints(3);
      await drawArea(user, points);

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/search-area",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ tripId: TRIP_ID, points }),
        }),
      );
    });

    it("zeigt keine Flaeche, wenn bei zwei Punkten der erste erneut angeklickt wird", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true })),
      );
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      await drawArea(user, squarePoints(2));

      expect(
        MapLibreMap.instances.at(-1)!.getSource("search-area")?.data.features,
      ).toHaveLength(0);
    });

    it("zeigt keine Flaeche, wenn nach drei Punkten Escape gedrueckt wird", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      await user.click(
        screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
      );
      for (const point of squarePoints(3)) {
        await clickMapAt(point);
      }
      await act(async () => {
        fireEvent.keyDown(window, { key: "Escape" });
      });

      expect(
        MapLibreMap.instances.at(-1)!.getSource("search-area")?.data.features,
      ).toHaveLength(0);
    });

    it("zeigt ein bereits gespeichertes Suchgebiet nach dem Laden der Seite an", async () => {
      const points = squarePoints(4);
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      expect(searchAreaRing()).toHaveLength(5);
    });

    it("laesst die Flaeche einem verschobenen Eckpunkt folgen und meldet die neue Position an den Server", async () => {
      const points = squarePoints(4);
      const fetchMock = vi.fn(async () => ({ ok: true }));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      const vertex = screen.getByRole("button", { name: "Eckpunkt 1" });
      const marker = Marker.instances.find((m) => m.getElement() === vertex)!;
      await act(async () => {
        marker.simulateDragTo([20, 21]);
      });

      expect(searchAreaRing()?.[0]).toEqual([20, 21]);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/search-area",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            tripId: TRIP_ID,
            points: [{ lat: 21, lng: 20 }, points[1], points[2], points[3]],
          }),
        }),
      );
    });

    it("erhoeht die Eckenzahl auf fuenf, wenn zwischen zwei benachbarten Ecken ein Punkt eingefuegt wird", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true })),
      );
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(4) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      const insertHandle = screen.getAllByRole("button", {
        name: "Eckpunkt einfügen",
      })[0];
      await act(async () => {
        fireEvent.click(insertHandle);
      });

      expect(
        screen.getAllByRole("button", { name: /^Eckpunkt \d+$/ }),
      ).toHaveLength(5);
    });

    it("verringert die Eckenzahl auf vier, wenn eine Ecke einer Flaeche mit fuenf Ecken entfernt wird", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true })),
      );
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(5) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      const vertex = screen.getByRole("button", { name: "Eckpunkt 1" });
      await act(async () => {
        fireEvent.contextMenu(vertex);
      });

      expect(
        screen.getAllByRole("button", { name: /^Eckpunkt \d+$/ }),
      ).toHaveLength(4);
    });

    it("laesst eine Flaeche mit drei Ecken unveraendert, wenn eine Ecke entfernt werden soll", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true })),
      );
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(3) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      const vertex = screen.getByRole("button", { name: "Eckpunkt 1" });
      await act(async () => {
        fireEvent.contextMenu(vertex);
      });

      expect(
        screen.getAllByRole("button", { name: /^Eckpunkt \d+$/ }),
      ).toHaveLength(3);
    });

    it("laesst keine Flaeche mehr sichtbar, nachdem die Entfernen-Schaltflaeche angeklickt wurde", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn(async () => ({ ok: true }));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(4) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      await user.click(
        screen.getByRole("button", { name: "Suchgebiet entfernen" }),
      );

      expect(
        MapLibreMap.instances.at(-1)!.getSource("search-area")?.data.features,
      ).toHaveLength(0);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/search-area",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ tripId: TRIP_ID }),
        }),
      );
    });

    it("zeigt nach dem Zeichnen einer neuen Flaeche mit fuenf Ecken nur noch diese", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true })),
      );
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(4) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      await drawArea(user, squarePoints(5));

      expect(
        screen.getAllByRole("button", { name: /^Eckpunkt \d+$/ }),
      ).toHaveLength(5);
    });

    it("laesst die POI-Liste bei einer gezeichneten Flaeche unveraendert", async () => {
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(4) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      expect(screen.getAllByRole("listitem")).toHaveLength(12);
    });
  });

  describe("POI-Suche per KI (req-014)", () => {
    const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

    function squarePoints(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        lat: 40.8 + i * 0.01,
        lng: 14.2 + i * 0.01,
      }));
    }

    function newPoi(name: string): Poi {
      return {
        id: `new-${name}`,
        tripId: TRIP_ID,
        number: 13,
        name,
        ort: "Alberobello",
        type: "sehenswuerdigkeit",
        position: { lat: 40.805, lng: 14.205 },
        status: "weiss_nicht",
      };
    }

    it("ist ohne gezeichnetes Suchgebiet nicht bedienbar und nennt den Grund", () => {
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);

      expect(
        screen.getByRole("button", { name: "POIs per KI suchen" }),
      ).toBeDisabled();
      expect(
        screen.getByText("Zuerst ein Suchgebiet auf der Karte zeichnen."),
      ).toBeInTheDocument();
    });

    it("fuegt bei gezeichnetem Suchgebiet neu gefundene POIs der Liste hinzu und nennt ihre Anzahl", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          addedCount: 2,
          discardedCount: 1,
          createdPois: [newPoi("Trulli di Alberobello"), newPoi("Rione Monti")],
        }),
      }));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(4) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      await user.click(
        screen.getByRole("button", { name: "POIs per KI suchen" }),
      );

      expect(screen.getAllByRole("listitem")).toHaveLength(14);
      expect(screen.getByTestId("ai-search-result")).toHaveTextContent(
        "2 neue POIs angelegt, 1 Vorschläge verworfen.",
      );
    });

    it("sendet den gewaehlten Typfilter und den eingegebenen Wunsch an den Server", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          addedCount: 0,
          discardedCount: 0,
          createdPois: [],
        }),
      }));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(4) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      await user.click(screen.getByRole("button", { name: "Restaurant" }));
      await user.type(
        screen.getByRole("textbox", { name: "Wunsch für die POI-Suche" }),
        "mit Kindern",
      );
      await user.click(
        screen.getByRole("button", { name: "POIs per KI suchen" }),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/poi-search",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            tripId: TRIP_ID,
            typeFilter: "restaurant",
            wish: "mit Kindern",
          }),
        }),
      );
    });

    it("laesst die POI-Liste unveraendert und zeigt einen Hinweis, wenn die Suche fehlschlaegt", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, json: async () => ({}) })),
      );
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          searchAreas={[{ tripId: TRIP_ID, points: squarePoints(4) }]}
          today={TODAY}
        />,
      );
      await flushMapReady();

      await user.click(
        screen.getByRole("button", { name: "POIs per KI suchen" }),
      );

      expect(screen.getAllByRole("listitem")).toHaveLength(12);
      expect(screen.getByTestId("ai-search-error")).toBeInTheDocument();
    });
  });

  describe("Bereich Planung (req-011)", () => {
    async function openPlanung() {
      const user = userEvent.setup();
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          activities={DEMO_ACTIVITIES}
          transfers={DEMO_TRANSFERS}
          today={TODAY}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Planung" }));
      return user;
    }

    async function selectDay(
      user: ReturnType<typeof userEvent.setup>,
      label: string,
    ) {
      const tab = screen.getByText(label).closest("button")!;
      await user.click(tab);
    }

    it("zeigt drei Spalten nebeneinander", async () => {
      await openPlanung();

      expect(
        screen.getByRole("heading", { name: "Noch unverplant" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tablist", { name: "Reisetag wählen" }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("day-route-map")).toBeInTheDocument();
    });

    // Der 18.07. traegt seit req-018 zusaetzlich den Ausgangspunkt der
    // Anreise ("Wien") als gewoehnlichen Programmpunkt -- daher fuenf statt
    // der urspruenglich vier Bloecke.
    it("zeigt fuer einen Reisetag mit fuenf Programmpunkten fuenf Bloecke im Zeitstrahl", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");

      expect(screen.getAllByTestId(/^activity-block-/)).toHaveLength(5);
    });

    it("erstreckt einen Block von 10:00 bis 12:30 ueber zweieinhalb Stunden des Rasters", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");

      const domVonAmalfi = DEMO_ACTIVITIES.find(
        (a) => a.title === "Dom von Amalfi",
      )!;
      const block = screen.getByTestId(`activity-block-${domVonAmalfi.id}`);
      expect(block.style.height).toBe("120px");
    });

    it("reicht das Raster bis 01:00, wenn der spaeteste Programmpunkt um 00:30 endet", async () => {
      const user = await openPlanung();
      await selectDay(user, "19.07.");

      expect(screen.getByText("01:00")).toBeInTheDocument();
    });

    it("zeigt fuer einen Reisetag ohne Programmpunkte das Raster von 08:00 bis 22:00 ohne Bloecke", async () => {
      // TODAY (20.07.) ist bewusst ohne Programmpunkte (siehe
      // tests/fixtures/demo-activities.ts) und ist zugleich der
      // vorausgewaehlte Tag fuer dieses Datum.
      await openPlanung();

      expect(screen.getByText("08:00")).toBeInTheDocument();
      expect(screen.getByText("22:00")).toBeInTheDocument();
      expect(screen.queryAllByTestId(/^activity-block-/)).toHaveLength(0);
    });

    it("zeigt zwischen zwei Programmpunkten mit hinterlegtem Transfer einen gestrichelten Block", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");

      expect(screen.getAllByTestId(/^transfer-block-/).length).toBeGreaterThan(
        0,
      );
    });

    it('zeigt einen unverknuepften POI mit Status "Gesetzt" in "Noch unverplant"', async () => {
      await openPlanung();

      expect(screen.getByText("Altstadt & Spaccanapoli")).toBeInTheDocument();
    });

    it('zeigt einen mit einem Programmpunkt verknuepften POI NICHT in "Noch unverplant"', async () => {
      await openPlanung();

      expect(
        screen.queryByText("Ausgrabungsstätte Pompeji"),
      ).not.toBeInTheDocument();
    });

    it("zeigt auf der Karte fuenf nummerierte Wegpunkte fuer einen Tag mit fuenf Programmpunkten", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");
      await flushMapReady();

      expect(screen.getAllByTestId(/^waypoint-marker-/)).toHaveLength(5);
    });

    it("zeigt beim Wechsel des Tagesreiters die Programmpunkte des gewaehlten Tages", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");
      expect(screen.getAllByTestId(/^activity-block-/)).toHaveLength(5);

      await selectDay(user, "19.07.");

      const bootstour = DEMO_ACTIVITIES.find(
        (a) => a.title === "Bootstour nach Capri",
      )!;
      expect(
        screen.getByTestId(`activity-block-${bootstour.id}`),
      ).toBeInTheDocument();
      const domVonAmalfi = DEMO_ACTIVITIES.find(
        (a) => a.title === "Dom von Amalfi",
      )!;
      expect(
        screen.queryByTestId(`activity-block-${domVonAmalfi.id}`),
      ).not.toBeInTheDocument();
    });

    it('aendert bei Klick auf "KI planen lassen" nichts an der Anzeige', async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");

      await user.click(
        screen.getByRole("button", { name: "KI planen lassen" }),
      );

      expect(screen.getAllByTestId(/^activity-block-/)).toHaveLength(5);
    });

    it("veraendert die Lage eines Blocks NICHT, wenn ich ihn mit der Maus zu ziehen versuche", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");

      const domVonAmalfi = DEMO_ACTIVITIES.find(
        (a) => a.title === "Dom von Amalfi",
      )!;
      const block = screen.getByTestId(`activity-block-${domVonAmalfi.id}`);
      const topBefore = block.style.top;

      fireEvent.mouseDown(block, { clientX: 0, clientY: 0 });
      fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
      fireEvent.mouseUp(window);

      expect(block.style.top).toBe(topBefore);
    });
  });

  describe("Reisen verwalten (req-017)", () => {
    const FLORENZ = {
      name: "Florenz",
      context: "Toskana, Italien",
      lat: 43.7696,
      lng: 11.2558,
    };

    /**
     * Beantwortet Ortssuche und Reise-Schnittstelle; die angelegte bzw.
     * geaenderte Reise wird aus dem gesendeten Rumpf gebildet, wie es der
     * Server tut.
     */
    function stubApi() {
      const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
        if (String(url).startsWith("/api/place-search")) {
          return { ok: true, json: async () => ({ places: [FLORENZ] }) };
        }
        if (options?.method === "DELETE") {
          return { ok: true, json: async () => ({ status: "ok" }) };
        }
        const body = JSON.parse(String(options?.body ?? "{}"));
        return {
          ok: true,
          json: async () => ({
            trip: {
              id: body.id ?? "neu-toskana",
              title: body.title,
              startDate: body.startDate,
              endDate: body.endDate,
              mainPlace: body.mainPlace,
            },
          }),
        };
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    function renderPlaner(trips = DEMO_TRIPS) {
      const user = userEvent.setup();
      render(
        <PlanView
          trips={trips}
          pois={DEMO_POIS}
          activities={DEMO_ACTIVITIES}
          transfers={DEMO_TRANSFERS}
          today={TODAY}
        />,
      );
      return user;
    }

    async function openTripList(user: ReturnType<typeof userEvent.setup>) {
      await user.click(
        screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
      );
      return screen.getByRole("dialog", { name: "Reise wählen" });
    }

    function setDate(label: string, value: string) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }

    async function chooseMainPlace(
      user: ReturnType<typeof userEvent.setup>,
      query: string,
    ) {
      await user.type(screen.getByLabelText("Hauptort"), query);
      const list = await screen.findByRole("list", { name: "Ortsvorschläge" });
      await user.click(within(list).getByText(FLORENZ.name));
    }

    async function fillTripForm(
      user: ReturnType<typeof userEvent.setup>,
      title: string,
      startDate: string,
      endDate: string,
    ) {
      if (title) await user.type(screen.getByLabelText("Titel"), title);
      setDate("Beginn", startDate);
      setDate("Ende", endDate);
      await chooseMainPlace(user, "Floren");
    }

    it('zeigt im Aufklappmenü am Reisenamen den Eintrag "Neue Reise"', async () => {
      stubApi();
      const user = renderPlaner();

      const dialog = await openTripList(user);

      expect(
        within(dialog).getByRole("button", { name: "Neue Reise" }),
      ).toBeInTheDocument();
    });

    it('zeigt "Toskana 2027" im Kopfbereich, nachdem die Reise angelegt wurde', async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await fillTripForm(user, "Toskana 2027", "2027-05-12", "2027-05-19");
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByRole("banner")).toHaveTextContent("Toskana 2027");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/trips",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            title: "Toskana 2027",
            startDate: "2027-05-12",
            endDate: "2027-05-19",
            mainPlace: {
              name: "Florenz",
              lat: FLORENZ.lat,
              lng: FLORENZ.lng,
            },
          }),
        }),
      );
    });

    it("enthält die Reiseliste nach dem Anlegen vier Reisen", async () => {
      stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await fillTripForm(user, "Toskana 2027", "2027-05-12", "2027-05-19");
      await user.click(screen.getByRole("button", { name: "Speichern" }));
      await user.click(screen.getByRole("button", { name: /^Toskana 2027/ }));

      const dialog = screen.getByRole("dialog", { name: "Reise wählen" });
      expect(within(dialog).getAllByRole("listitem")).toHaveLength(4);
    });

    it('zeigt beim Eintippen von "Floren" Ortsvorschläge zur Auswahl', async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await user.type(screen.getByLabelText("Hauptort"), "Floren");

      const list = await screen.findByRole("list", { name: "Ortsvorschläge" });
      expect(within(list).getByText("Florenz")).toBeInTheDocument();
      expect(within(list).getByText("Toskana, Italien")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/place-search?q=Floren");
    });

    it("legt ohne Titel keine Reise an", async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await fillTripForm(user, "", "2027-05-12", "2027-05-19");
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByText(TRIP_ERRORS.titleRequired)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/trips",
        expect.anything(),
      );
      expect(
        screen.getByRole("dialog", { name: "Neue Reise" }),
      ).toBeInTheDocument();
    });

    it("legt keine Reise an, deren Ende vor dem Beginn liegt", async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await fillTripForm(user, "Toskana 2027", "2027-05-12", "2027-05-05");
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByText(TRIP_ERRORS.endBeforeStart)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/trips",
        expect.anything(),
      );
    });

    it("legt ohne gewählten Hauptort keine Reise an", async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await user.type(screen.getByLabelText("Titel"), "Toskana 2027");
      setDate("Beginn", "2027-05-12");
      setDate("Ende", "2027-05-19");
      // Von Hand eingetippt, aber kein Vorschlag gewaehlt -- ohne Position
      // aus der Ortssuche wird nicht gespeichert.
      await user.type(screen.getByLabelText("Hauptort"), "Floren");
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      expect(
        screen.getByText(TRIP_ERRORS.mainPlaceRequired),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/trips",
        expect.anything(),
      );
    });

    it("zeigt den geänderten Titel im Kopfbereich", async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      const dialog = await openTripList(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: "Reise ändern: Süditalien Rundreise",
        }),
      );
      const titleField = screen.getByLabelText("Titel");
      await user.clear(titleField);
      await user.type(titleField, "Toskana Frühling 2027");
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByRole("banner")).toHaveTextContent(
        "Toskana Frühling 2027",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/trips",
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("übernimmt Titel, Zeitraum und Hauptort der Reise ins Formular", async () => {
      stubApi();
      const user = renderPlaner();

      const dialog = await openTripList(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: "Reise ändern: Süditalien Rundreise",
        }),
      );

      expect(screen.getByLabelText("Titel")).toHaveValue(
        "Süditalien Rundreise",
      );
      expect(screen.getByLabelText("Beginn")).toHaveValue("2026-07-18");
      expect(screen.getByLabelText("Ende")).toHaveValue("2026-07-23");
      expect(screen.getByLabelText("Hauptort")).toHaveValue("Amalfi");
    });

    it("nennt in der Rückfrage vor dem Löschen die Anzahl der betroffenen POIs", async () => {
      stubApi();
      const user = renderPlaner();

      const dialog = await openTripList(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: "Reise löschen: Süditalien Rundreise",
        }),
      );

      // Die Suditalien Rundreise hat zwoelf POIs (tests/fixtures/demo-pois.ts).
      expect(screen.getByTestId("trip-delete-losses")).toHaveTextContent(
        "12 POIs",
      );
    });

    it("lässt die Reise bestehen, wenn die Rückfrage abgebrochen wird", async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      const dialog = await openTripList(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: "Reise löschen: Süditalien Rundreise",
        }),
      );
      await user.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/trips",
        expect.anything(),
      );
      expect(screen.getByRole("banner")).toHaveTextContent(
        "Süditalien Rundreise",
      );
    });

    it("entfernt die Reise nach dem Bestätigen aus der Liste", async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      const dialog = await openTripList(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: "Reise löschen: Süditalien Rundreise",
        }),
      );
      await user.click(
        screen.getByRole("button", { name: "Endgültig löschen" }),
      );
      await user.click(
        screen.getByRole("button", { name: /^Wien Städtereise/ }),
      );

      const liste = screen.getByRole("dialog", { name: "Reise wählen" });
      expect(within(liste).getAllByRole("listitem")).toHaveLength(2);
      expect(
        within(liste).queryByText("Süditalien Rundreise"),
      ).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/trips",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ id: DEMO_TRIPS[0].id }),
        }),
      );
    });

    it("öffnet eine andere Reise, wenn die geöffnete gelöscht wurde", async () => {
      stubApi();
      const user = renderPlaner();

      const dialog = await openTripList(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: "Reise löschen: Süditalien Rundreise",
        }),
      );
      await user.click(
        screen.getByRole("button", { name: "Endgültig löschen" }),
      );

      // Naechste geplante Reise nach derselben Regel wie beim ersten Aufruf.
      expect(screen.getByRole("banner")).toHaveTextContent("Wien Städtereise");
    });

    it("fordert zum Anlegen auf, wenn es keine Reise gibt", () => {
      render(<PlanView trips={[]} today={TODAY} />);

      expect(screen.getByText("Noch keine Reise")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Neue Reise" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    });

    it("öffnet aus der Aufforderung heraus das Formular", async () => {
      stubApi();
      const user = userEvent.setup();
      render(<PlanView trips={[]} today={TODAY} />);

      await user.click(screen.getByRole("button", { name: "Neue Reise" }));

      expect(
        screen.getByRole("dialog", { name: "Neue Reise" }),
      ).toBeInTheDocument();
    });

    it("zeigt für eine neu angelegte Reise eine leere POI-Liste", async () => {
      stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await fillTripForm(user, "Toskana 2027", "2027-05-12", "2027-05-19");
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.getByText("0 von 0")).toBeInTheDocument();
    });

    it("lässt die Eingaben stehen und weist hin, wenn das Speichern fehlschlägt", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
          String(url).startsWith("/api/place-search")
            ? { ok: true, json: async () => ({ places: [FLORENZ] }) }
            : { ok: false, json: async () => ({}) },
        ),
      );
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await fillTripForm(user, "Toskana 2027", "2027-05-12", "2027-05-19");
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      await waitFor(() =>
        expect(screen.getByTestId("trip-save-error")).toBeInTheDocument(),
      );
      expect(screen.getByLabelText("Titel")).toHaveValue("Toskana 2027");
      expect(screen.getByRole("banner")).toHaveTextContent(
        "Süditalien Rundreise",
      );
    });
  });

  describe("Bereich Einstellungen (req-019)", () => {
    const UWE = {
      id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
      accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
      name: "Uwe Kremmel",
      nickname: null,
      email: "uwe@kremmel.org",
      phone: null,
      iban: null,
      loginEnabled: true,
    };

    async function openEinstellungen() {
      const user = userEvent.setup();
      render(
        <PlanView
          trips={DEMO_TRIPS}
          participants={[UWE]}
          selfParticipantId={UWE.id}
          today={TODAY}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Einstellungen" }));
      return user;
    }

    it('zeigt die Karte "Reiseteilnehmer"', async () => {
      await openEinstellungen();

      expect(
        screen.getByRole("heading", { name: /Reiseteilnehmer/ }),
      ).toBeInTheDocument();
    });

    it("zeigt dort den eigenen Eintrag, als eigene Person gekennzeichnet", async () => {
      await openEinstellungen();

      const zeile = screen.getByText("Uwe Kremmel").closest("li")!;
      expect(zeile).toHaveTextContent("uwe@kremmel.org");
      expect(zeile).toHaveTextContent("Du");
    });
  });
});
