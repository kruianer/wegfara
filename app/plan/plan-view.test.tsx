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
import type { TripParticipant, TripRole } from "@/lib/trip-participants/types";
import { TRIP_ERRORS } from "@/lib/trips/validate";
import { TRIP_STATE_ERRORS, type TripState } from "@/lib/trips/state";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";
import { DEMO_POIS } from "@/tests/fixtures/demo-pois";
import { DEMO_ACTIVITIES } from "@/tests/fixtures/demo-activities";
import { DEMO_TRANSFERS } from "@/tests/fixtures/demo-transfers";
import { HOUR_HEIGHT_PX } from "@/lib/plan/timeline-grid";
import { movedActivityTimes } from "@/lib/plan/move-activity";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import type { ApiKeyState } from "@/lib/api-keys/types";
import { MapLibreMap, Marker } from "@/tests/mocks/maplibre-gl";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const TODAY = "2026-07-20";

/**
 * Beide Zugangsschluessel des Accounts hinterlegt (req-028) -- ohne sie sind
 * die KI-Suche und der Import aus einem Google-Maps-Link gesperrt. Die
 * Sperre selbst prueft der Abschnitt "Zugangsschluessel (req-028)".
 */
const BEIDE_SCHLUESSEL = [
  { kind: "ki_suche" as const, lastFour: "a3f9" },
  { kind: "google" as const, lastFour: "bbbb" },
];

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

  // Die sechs Bereiche der geoeffneten Reise aus req-009. "Mein Bereich"
  // steht seit req-043 daneben, ist aber keiner von ihnen: er fuehrt auf
  // eine eigene Seite.
  it("zeigt genau sechs Bereichsschaltflächen", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(within(nav).getAllByRole("button")).toHaveLength(6);
  });

  it("zeigt „Mein Bereich“ im Kopfbereich als Verweis (req-043)", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(
      within(nav).getByRole("link", { name: "Mein Bereich" }),
    ).toHaveAttribute("href", MEIN_BEREICH_PATH);
  });

  it("kennt die Bereiche „Konto“, „Account“ und „Nutzer“ nicht mehr (req-043)", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    for (const name of ["Konto", "Account", "Nutzer"]) {
      expect(within(nav).queryByText(name)).toBeNull();
    }
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
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={DEMO_POIS}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );

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
          apiKeys={BEIDE_SCHLUESSEL}
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
          apiKeys={BEIDE_SCHLUESSEL}
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
          apiKeys={BEIDE_SCHLUESSEL}
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
              state: body.state ?? "in_planung",
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

    /**
     * Der Weg zu den Eckdaten einer Reise fuehrt seit req-033 ueber das
     * Aufklappmenue in die Reisedetails -- ein Formular oeffnet sich nicht
     * mehr.
     */
    async function openTripDetails(
      user: ReturnType<typeof userEvent.setup>,
      title = "Süditalien Rundreise",
    ) {
      const dialog = await openTripList(user);
      await user.click(
        within(dialog).getByRole("button", { name: `Reisedetails: ${title}` }),
      );
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
            description: "",
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
      // Die Eingaben bleiben in den Reisedetails stehen (req-033).
      expect(
        screen.getByRole("region", { name: "Eckdaten der Reise" }),
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

      await openTripDetails(user);
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

    it("übernimmt Titel, Zeitraum und Hauptort der Reise in die Eckdaten", async () => {
      stubApi();
      const user = renderPlaner();

      await openTripDetails(user);

      expect(screen.getByLabelText("Titel")).toHaveValue(
        "Süditalien Rundreise",
      );
      expect(screen.getByLabelText("Beginn")).toHaveValue("2026-07-18");
      expect(screen.getByLabelText("Ende")).toHaveValue("2026-07-23");
      expect(screen.getByLabelText("Hauptort")).toHaveValue("Amalfi");
    });

    /** Geloescht wird seit req-033 in den Reisedetails der Reise. */
    async function askToDeleteTrip(user: ReturnType<typeof userEvent.setup>) {
      await openTripDetails(user);
      await user.click(screen.getByRole("button", { name: "Reise löschen" }));
    }

    it("nennt in der Rückfrage vor dem Löschen die Anzahl der betroffenen POIs", async () => {
      stubApi();
      const user = renderPlaner();

      await askToDeleteTrip(user);

      // Die Suditalien Rundreise hat zwoelf POIs (tests/fixtures/demo-pois.ts).
      expect(screen.getByTestId("trip-delete-losses")).toHaveTextContent(
        "12 POIs",
      );
    });

    it("lässt die Reise bestehen, wenn die Rückfrage abgebrochen wird", async () => {
      const fetchMock = stubApi();
      const user = renderPlaner();

      await askToDeleteTrip(user);
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

      await askToDeleteTrip(user);
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

      await askToDeleteTrip(user);
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

    it("öffnet aus der Aufforderung heraus die Reisedetails", async () => {
      stubApi();
      const user = userEvent.setup();
      render(<PlanView trips={[]} today={TODAY} />);

      await user.click(screen.getByRole("button", { name: "Neue Reise" }));

      expect(
        screen.getByRole("region", { name: "Eckdaten der Reise" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Titel")).toHaveValue("");
    });

    it("zeigt für eine neu angelegte Reise eine leere POI-Liste", async () => {
      stubApi();
      const user = renderPlaner();

      await openTripList(user);
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await fillTripForm(user, "Toskana 2027", "2027-05-12", "2027-05-19");
      await user.click(screen.getByRole("button", { name: "Speichern" }));
      // Nach dem Anlegen stehen die Reisedetails der neuen Reise offen
      // (req-033) -- die POI-Liste liegt im Bereich "POIs".
      await user.click(screen.getByRole("button", { name: "POIs" }));

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

  describe("Teilnehmer einer Reise (req-021)", () => {
    const UWE = {
      id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
      accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
      name: "Uwe Kremmel",
      nickname: null,
      email: "uwe@kremmel.org",
      phone: null,
      iban: null,
      loginEnabled: true,
      accountAdmin: true,
    };
    const CLARA = {
      ...UWE,
      id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
      name: "Clara Berger",
      email: null,
      loginEnabled: false,
      accountAdmin: false,
    };
    const SUEDITALIEN_ID = DEMO_TRIPS[0].id;
    const WIEN_ID = DEMO_TRIPS[1].id;

    function zuordnung(
      tripId: string,
      participantId: string,
      role: TripRole,
    ): TripParticipant {
      return { tripId, participantId, role };
    }

    /** Nur bei der Sueditalien-Rundreise faehrt Clara mit. */
    const ZUORDNUNGEN: TripParticipant[] = [
      zuordnung(SUEDITALIEN_ID, UWE.id, "reiseleiter"),
      zuordnung(SUEDITALIEN_ID, CLARA.id, "teilnehmer"),
      zuordnung(WIEN_ID, UWE.id, "reiseleiter"),
    ];

    function karte(): HTMLElement {
      return screen.getByRole("region", { name: "Wer fährt mit" });
    }

    async function openReisedetails(
      tripParticipants: TripParticipant[] = ZUORDNUNGEN,
    ) {
      const user = userEvent.setup();
      render(
        <PlanView
          trips={DEMO_TRIPS}
          participants={[UWE, CLARA]}
          tripParticipants={tripParticipants}
          today={TODAY}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Reisedetails" }));
      return user;
    }

    async function wechsleZu(
      user: ReturnType<typeof userEvent.setup>,
      titel: string,
    ) {
      await user.click(
        screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
      );
      const dialog = screen.getByRole("dialog", { name: "Reise wählen" });
      await user.click(within(dialog).getByText(titel));
    }

    it('zeigt die Karte "Wer fährt mit" mit der Zuordnung der geöffneten Reise', async () => {
      await openReisedetails();

      expect(within(karte()).getByLabelText("Rolle: Clara Berger")).toHaveValue(
        "teilnehmer",
      );
    });

    it("zeigt beim Wechsel der Reise deren eigene Zuordnung", async () => {
      const user = await openReisedetails();

      await wechsleZu(user, "Wien Städtereise");

      expect(
        within(karte()).queryByLabelText("Rolle: Clara Berger"),
      ).toBeNull();
      expect(
        within(karte()).getByRole("button", {
          name: "Zur Reise hinzufügen: Clara Berger",
        }),
      ).toBeInTheDocument();
    });

    /**
     * Welche Bereiche sich oeffnen lassen -- gemessen daran, welcher
     * Bereich nach dem Klick der aktive ist.
     */
    async function bedienbareBereiche(): Promise<string[]> {
      const user = userEvent.setup();
      const { unmount } = render(
        <PlanView
          trips={DEMO_TRIPS}
          participants={[UWE, CLARA]}
          tripParticipants={ZUORDNUNGEN}
          today={TODAY}
        />,
      );
      const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
      const anzahl = within(nav).getAllByRole("button").length;
      const offen: string[] = [];
      for (let index = 0; index < anzahl; index += 1) {
        const knopf = within(nav).getAllByRole("button")[index];
        await user.click(knopf);
        if (
          within(nav)
            .getAllByRole("button")
            [index].getAttribute("aria-current") === "page"
        ) {
          offen.push(knopf.textContent ?? "");
        }
      }
      unmount();
      return offen;
    }

    /**
     * Die Rolle schraenkt vorerst nichts ein (req-021): der Planer kennt
     * sie gar nicht -- welche Bereiche sich oeffnen lassen, haengt allein
     * an SWITCHABLE_PLAN_AREAS.
     */
    it("lässt für jeden dieselben Bereiche öffnen, unabhängig von der Rolle", async () => {
      const offen = await bedienbareBereiche();

      expect(offen).toEqual(["POIs", "Planung", "Dokumente", "Reisedetails"]);
    });

    it("ordnet den Anlegenden einer neuen Reise als Reiseleiter zu", async () => {
      const user = userEvent.setup();
      const neu = {
        id: "neu-toskana",
        title: "Toskana 2027",
        startDate: "2027-05-12",
        endDate: "2027-05-19",
        mainPlace: { name: "Florenz", lat: 43.7696, lng: 11.2558 },
        state: "in_planung",
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (String(url).startsWith("/api/place-search")) {
            return {
              ok: true,
              json: async () => ({ places: [{ ...neu.mainPlace }] }),
            };
          }
          return {
            ok: true,
            json: async () => ({
              trip: neu,
              tripParticipant: zuordnung(neu.id, UWE.id, "reiseleiter"),
            }),
          };
        }),
      );
      render(
        <PlanView
          trips={DEMO_TRIPS}
          participants={[UWE, CLARA]}
          tripParticipants={ZUORDNUNGEN}
          today={TODAY}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
      );
      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await user.type(screen.getByLabelText("Titel"), neu.title);
      fireEvent.change(screen.getByLabelText("Beginn"), {
        target: { value: neu.startDate },
      });
      fireEvent.change(screen.getByLabelText("Ende"), {
        target: { value: neu.endDate },
      });
      await user.type(screen.getByLabelText("Hauptort"), "Floren");
      const liste = await screen.findByRole("list", {
        name: "Ortsvorschläge",
      });
      await user.click(within(liste).getByText("Florenz"));
      await user.click(screen.getByRole("button", { name: "Speichern" }));
      await user.click(screen.getByRole("button", { name: "Reisedetails" }));

      expect(screen.getByRole("banner")).toHaveTextContent(neu.title);
      expect(within(karte()).getByLabelText("Rolle: Uwe Kremmel")).toHaveValue(
        "reiseleiter",
      );
      expect(
        within(karte()).getByRole("button", {
          name: "Zur Reise hinzufügen: Clara Berger",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Zustand einer Reise (req-022)", () => {
    /** Beantwortet das Setzen des Zustands; `ok` steuert Gelingen. */
    function stubStateApi(ok = true) {
      const fetchMock = vi.fn(async () => ({
        ok,
        json: async () => ({ status: ok ? "ok" : "fehler" }),
      }));
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    function trips(state: TripState, id = DEMO_TRIPS[0].id) {
      return DEMO_TRIPS.map((trip) =>
        trip.id === id ? { ...trip, state } : trip,
      );
    }

    /** Oeffnet das Aufklappmenue am Reisenamen. */
    async function openTripList(tripsToShow = DEMO_TRIPS, today = TODAY) {
      const user = userEvent.setup();
      render(<PlanView trips={tripsToShow} today={today} />);
      await user.click(
        screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
      );
      return user;
    }

    /**
     * Oeffnet die Reisedetails der geoeffneten Reise -- dort wird der
     * Zustand seit req-033 gesetzt.
     */
    async function openReisedetails(tripsToShow = DEMO_TRIPS, today = TODAY) {
      const user = userEvent.setup();
      render(<PlanView trips={tripsToShow} today={today} />);
      await user.click(screen.getByRole("button", { name: "Reisedetails" }));
      return user;
    }

    function zustand(title = "Süditalien Rundreise") {
      return screen.getByLabelText(`Zustand: ${title}`);
    }

    it("zeigt im Aufklappmenü am Reisenamen den Zustand der Reise", async () => {
      stubStateApi();
      await openTripList();

      expect(zustand()).toHaveTextContent("In Planung");
    });

    it('setzt die Reise von "In Planung" auf "Freigegeben"', async () => {
      const fetchMock = stubStateApi();
      const user = await openReisedetails();

      await user.selectOptions(zustand(), "freigegeben");

      expect(zustand()).toHaveDisplayValue("Freigegeben");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/trips",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            id: DEMO_TRIPS[0].id,
            state: "freigegeben",
          }),
        }),
      );
    });

    it('steht nach dem Neuladen der Seite weiterhin auf "Freigegeben"', async () => {
      stubStateApi();
      // Ein Neuladen holt die Reisen erneut vom Server; dass der Zustand
      // dort ankommt, prueft app/api/trips/route.test.ts.
      await openReisedetails(trips("freigegeben"));

      expect(zustand()).toHaveDisplayValue("Freigegeben");
    });

    it('nimmt die Freigabe zurueck -- "Freigegeben" wird wieder "In Planung"', async () => {
      stubStateApi();
      const user = await openReisedetails(trips("freigegeben"));

      await user.selectOptions(zustand(), "in_planung");

      expect(zustand()).toHaveDisplayValue("In Planung");
    });

    it('oeffnet eine abgeschlossene Reise wieder: "Abgeschlossen" wird "Freigegeben"', async () => {
      stubStateApi();
      const user = await openReisedetails(trips("abgeschlossen"));

      await user.selectOptions(zustand(), "freigegeben");

      expect(zustand()).toHaveDisplayValue("Freigegeben");
    });

    it('zeigt bei einer laufenden Reise "Aktiv" und "In Planung" nebeneinander', async () => {
      stubStateApi();
      // Am 20.07.2026 laeuft die Suditalien Rundreise (18.-23.07.2026).
      await openTripList(DEMO_TRIPS, "2026-07-20");

      // Beide Kennzeichnungen stehen in derselben Zeile der Reiseliste.
      const zeile = zustand().closest("li") as HTMLElement;
      expect(
        within(zeile).getByText("Süditalien Rundreise"),
      ).toBeInTheDocument();
      expect(within(zeile).getByText("Aktiv")).toBeInTheDocument();
      expect(zustand()).toHaveTextContent("In Planung");
    });

    it("hält eine Reise in Planung weiterhin auswählbar", async () => {
      stubStateApi();
      const user = await openTripList();

      const dialog = screen.getByRole("dialog", { name: "Reise wählen" });
      await user.click(within(dialog).getByText("Wien Städtereise"));

      expect(screen.getByRole("banner")).toHaveTextContent("Wien Städtereise");
    });

    it('zeigt bei einer neu angelegten Reise "In Planung"', async () => {
      const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
        if (String(url).startsWith("/api/place-search")) {
          return {
            ok: true,
            json: async () => ({
              places: [{ name: "Florenz", lat: 43.7696, lng: 11.2558 }],
            }),
          };
        }
        const body = JSON.parse(String(options?.body ?? "{}"));
        return {
          ok: true,
          json: async () => ({
            trip: {
              id: "neu-toskana",
              title: body.title,
              startDate: body.startDate,
              endDate: body.endDate,
              mainPlace: body.mainPlace,
              description: body.description,
              state: "in_planung",
            },
          }),
        };
      });
      vi.stubGlobal("fetch", fetchMock);
      const user = await openTripList();

      await user.click(screen.getByRole("button", { name: "Neue Reise" }));
      await user.type(screen.getByLabelText("Titel"), "Toskana 2027");
      fireEvent.change(screen.getByLabelText("Beginn"), {
        target: { value: "2027-05-12" },
      });
      fireEvent.change(screen.getByLabelText("Ende"), {
        target: { value: "2027-05-19" },
      });
      await user.type(screen.getByLabelText("Hauptort"), "Floren");
      const orte = await screen.findByRole("list", { name: "Ortsvorschläge" });
      await user.click(within(orte).getByText("Florenz"));
      await user.click(screen.getByRole("button", { name: "Speichern" }));

      // Nach dem Speichern stehen die Reisedetails der neuen Reise offen --
      // dort laesst sich ihr Zustand jetzt erstmals setzen (req-033).
      expect(zustand("Toskana 2027")).toHaveDisplayValue("In Planung");
    });

    it("lässt die Programmpunkte einer abgeschlossenen Reise betrachten", async () => {
      stubStateApi();
      const user = userEvent.setup();
      render(
        <PlanView
          trips={trips("abgeschlossen")}
          pois={DEMO_POIS}
          activities={DEMO_ACTIVITIES}
          transfers={DEMO_TRANSFERS}
          today={TODAY}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Planung" }));
      await user.click(screen.getByText("18.07.").closest("button")!);

      expect(screen.getByText("Dom von Amalfi")).toBeInTheDocument();
    });

    it("behält den bisherigen Zustand, wenn das Speichern fehlschlägt", async () => {
      stubStateApi(false);
      const user = await openReisedetails();

      await user.selectOptions(zustand(), "freigegeben");

      expect(zustand()).toHaveDisplayValue("In Planung");
      expect(screen.getByRole("status")).toHaveTextContent(
        TRIP_STATE_ERRORS.failed,
      );
    });
  });
  describe("POI aus einem Google-Maps-Link (req-026)", () => {
    const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
    const LINK = "https://maps.app.goo.gl/aBcD1234";

    function villaRufolo(overrides: Partial<Poi> = {}): Poi {
      return {
        id: "poi-villa-rufolo",
        tripId: TRIP_ID,
        number: 13,
        name: "Villa Rufolo",
        ort: "Ravello",
        type: "sehenswuerdigkeit",
        position: { lat: 40.6491, lng: 14.6113 },
        status: "weiss_nicht",
        address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
        phone: "+39 089 857621",
        openingHours: ["Montag: 09:00-20:00"],
        photos: [{ id: "foto-1", position: 1 }],
        ...overrides,
      };
    }

    function stubLinkApi(antwort: unknown) {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => antwort,
      }));
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    /** Link einfuegen und die Abfrage ausloesen. */
    async function linkEinfuegen(text = LINK) {
      const user = userEvent.setup();
      await user.type(
        screen.getByRole("textbox", { name: "Google-Maps-Link" }),
        text,
      );
      await user.click(screen.getByRole("button", { name: "POI aus Link" }));
      return user;
    }

    it("zeigt den angelegten POI mit seinem Namen in der Liste", async () => {
      stubLinkApi({ result: "angelegt", poi: villaRufolo() });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );

      await linkEinfuegen();

      expect(
        screen.getByRole("button", { name: "Villa Rufolo" }),
      ).toBeInTheDocument();
    });

    // Seit req-035 klappt die Zeile zu einem Formular auf, nicht mehr zu
    // einem Detail zum Lesen -- dieselben Angaben stehen dort änderbar.
    it("zeigt im aufgeklappten POI seine Adresse", async () => {
      stubLinkApi({ result: "angelegt", poi: villaRufolo() });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );
      const user = await linkEinfuegen();

      await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

      expect(screen.getByLabelText("Adresse")).toHaveValue(
        "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      );
    });

    it("zeigt im aufgeklappten POI ein Foto des Ortes", async () => {
      stubLinkApi({ result: "angelegt", poi: villaRufolo() });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );
      const user = await linkEinfuegen();

      await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

      expect(
        within(screen.getByTestId("poi-form-poi-villa-rufolo")).getByRole(
          "img",
          { name: "Bild 1 von Villa Rufolo" },
        ),
      ).toHaveAttribute("src", "/api/poi-fotos/foto-1");
    });

    it('gibt dem angelegten POI den Status "Weiß noch nicht"', async () => {
      stubLinkApi({ result: "angelegt", poi: villaRufolo() });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );

      await linkEinfuegen();

      expect(
        screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
      ).toHaveDisplayValue("Weiß noch nicht");
    });

    it("enthaelt die Liste nach dem zweiten Einfuegen weiterhin genau einen POI", async () => {
      stubLinkApi({ result: "aufgefrischt", poi: villaRufolo() });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[villaRufolo()]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );

      await linkEinfuegen();

      expect(
        screen.getAllByRole("button", { name: "Villa Rufolo" }),
      ).toHaveLength(1);
    });

    it('laesst dem aufgefrischten POI seinen Status "Gesetzt"', async () => {
      stubLinkApi({
        result: "aufgefrischt",
        poi: villaRufolo({ status: "gesetzt" }),
      });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[villaRufolo({ status: "gesetzt" })]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );

      await linkEinfuegen();

      expect(
        screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
      ).toHaveDisplayValue("Gesetzt");
    });

    it("legt bei einem Text, der kein Google-Maps-Link ist, keinen POI an", async () => {
      stubLinkApi({ result: "fehler", reason: "kein_google_link" });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );

      await linkEinfuegen("Villa Rufolo, Ravello");

      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("nennt in der Ergebniszeile den Grund des Fehlschlags", async () => {
      stubLinkApi({ result: "fehler", reason: "kein_google_link" });
      render(
        <PlanView
          trips={DEMO_TRIPS}
          pois={[]}
          apiKeys={BEIDE_SCHLUESSEL}
          today={TODAY}
        />,
      );

      await linkEinfuegen("Villa Rufolo, Ravello");

      expect(screen.getByTestId("poi-link-result")).toHaveTextContent(
        "Das ist kein Google-Maps-Link.",
      );
    });
  });
});

/**
 * Zugangsschluessel je Account (req-028) im Zusammenspiel: die Sperre im
 * Bereich "POIs". Hinterlegt werden die Schluessel seit req-043 in "Mein
 * Bereich" -- auf einer eigenen Seite, nicht mehr im Planer (siehe
 * app/mein-bereich/mein-bereich-view.test.tsx).
 */
describe("PlanView, Zugangsschlüssel (req-028)", () => {
  const OHNE_SCHLUESSEL: ApiKeyState[] = [
    { kind: "ki_suche", lastFour: null },
    { kind: "google", lastFour: null },
  ];

  beforeEach(() => {
    setWindowWidth(1440);
  });

  function zeige(apiKeys: ApiKeyState[] = OHNE_SCHLUESSEL) {
    render(
      <PlanView
        trips={DEMO_TRIPS}
        pois={DEMO_POIS}
        apiKeys={apiKeys}
        today={TODAY}
      />,
    );
  }

  it("sperrt ohne Schlüssel die KI-Suche und den Import aus einem Link", () => {
    zeige();

    expect(
      screen.getByRole("button", { name: "POIs per KI suchen" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: "Google-Maps-Link" }),
    ).toBeDisabled();
    expect(screen.getByTestId("ai-search-kein-schluessel")).toBeInTheDocument();
    expect(screen.getByTestId("poi-link-kein-schluessel")).toBeInTheDocument();
  });

  it("gibt die Funktionen frei, sobald der Schlüssel hinterlegt ist", () => {
    zeige([
      { kind: "ki_suche" as const, lastFour: "a3f9" },
      { kind: "google" as const, lastFour: null },
    ]);

    // Der Import aus Google bleibt ohne seinen eigenen Schluessel gesperrt.
    expect(
      screen.queryByTestId("ai-search-kein-schluessel"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("poi-link-kein-schluessel")).toBeInTheDocument();
  });

  /**
   * Die Karte "Zugangsschluessel" ist mit req-043 aus dem Planer
   * verschwunden -- sie steht in "Mein Bereich".
   */
  it("zeigt die Karte in keinem Bereich des Planers mehr (req-043)", () => {
    zeige();

    expect(
      screen.queryByRole("region", { name: "Zugangsschlüssel" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Der Bereich "Reisedetails" (req-033): alles zur geoeffneten Reise an
 * einer Stelle -- Eckdaten samt Beschreibung, Zustand und wer mitfaehrt.
 * Hier zaehlt das Zusammenspiel im Planer: der Weg dorthin, das Anlegen
 * einer neuen Reise ohne zweites Formular und was das Aufklappmenue am
 * Reisenamen davon noch traegt.
 */
describe("PlanView, Reisedetails (req-033)", () => {
  const FLORENZ = {
    name: "Florenz",
    context: "Toskana, Italien",
    lat: 43.7696,
    lng: 11.2558,
  };

  const UWE = {
    id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
    accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
    name: "Uwe Kremmel",
    nickname: null,
    email: "uwe@kremmel.org",
    phone: null,
    iban: null,
    loginEnabled: true,
    accountAdmin: true,
  };

  const ZUORDNUNGEN: TripParticipant[] = [
    { tripId: DEMO_TRIPS[0].id, participantId: UWE.id, role: "reiseleiter" },
  ];

  beforeEach(() => {
    setWindowWidth(1440);
  });

  /** Beantwortet Ortssuche und Reise-Schnittstelle wie der Server. */
  function stubApi() {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (String(url).startsWith("/api/place-search")) {
        return { ok: true, json: async () => ({ places: [FLORENZ] }) };
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
            description: body.description,
            state: "in_planung",
          },
          tripParticipant: body.id
            ? null
            : {
                tripId: "neu-toskana",
                participantId: UWE.id,
                role: "reiseleiter",
              },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function zeige(trips = DEMO_TRIPS) {
    const user = userEvent.setup();
    render(
      <PlanView
        trips={trips}
        participants={[UWE]}
        tripParticipants={ZUORDNUNGEN}
        today={TODAY}
      />,
    );
    return user;
  }

  async function oeffneReisedetails(trips = DEMO_TRIPS) {
    const user = zeige(trips);
    await user.click(screen.getByRole("button", { name: "Reisedetails" }));
    return user;
  }

  async function oeffneNeueReise() {
    const user = zeige();
    await user.click(
      screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
    );
    await user.click(screen.getByRole("button", { name: "Neue Reise" }));
    return user;
  }

  it('nennt den Bereich im Kopfbereich "Reisedetails"', () => {
    zeige();

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(
      within(nav).getByRole("button", { name: "Reisedetails" }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("button", { name: "Einstellungen" }),
    ).toBeNull();
  });

  it("zeigt dort den Titel der geöffneten Reise", async () => {
    await oeffneReisedetails();

    expect(screen.getByLabelText("Titel")).toHaveValue("Süditalien Rundreise");
  });

  it('zeigt dort die Karte "Wer fährt mit"', async () => {
    await oeffneReisedetails();

    expect(
      screen.getByRole("region", { name: "Wer fährt mit" }),
    ).toBeInTheDocument();
  });

  it("zeigt dort KEINE Karte mit den Personen des Accounts", async () => {
    await oeffneReisedetails();

    expect(
      screen.queryByRole("region", { name: "Reiseteilnehmer" }),
    ).toBeNull();
  });

  it("speichert eine eingetragene Beschreibung", async () => {
    const fetchMock = stubApi();
    const user = await oeffneReisedetails();

    await user.type(
      screen.getByLabelText("Beschreibung"),
      "Wanderschuhe mitnehmen.",
    );
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          id: DEMO_TRIPS[0].id,
          title: DEMO_TRIPS[0].title,
          startDate: DEMO_TRIPS[0].startDate,
          endDate: DEMO_TRIPS[0].endDate,
          mainPlace: DEMO_TRIPS[0].mainPlace,
          description: "Wanderschuhe mitnehmen.",
        }),
      }),
    );
  });

  it("zeigt eine gespeicherte Beschreibung nach dem Neuladen weiterhin an", async () => {
    // Ein Neuladen holt die Reisen erneut vom Server; dass die Beschreibung
    // dort ankommt, prueft app/api/trips/route.test.ts.
    const mitBeschreibung = DEMO_TRIPS.map((trip, index) =>
      index === 0 ? { ...trip, description: "Wanderschuhe mitnehmen." } : trip,
    );
    await oeffneReisedetails(mitBeschreibung);

    expect(screen.getByLabelText("Beschreibung")).toHaveValue(
      "Wanderschuhe mitnehmen.",
    );
  });

  it('setzt den Zustand dort auf "Freigegeben"', async () => {
    stubApi();
    const user = await oeffneReisedetails();

    await user.selectOptions(
      screen.getByLabelText("Zustand: Süditalien Rundreise"),
      "freigegeben",
    );

    expect(
      screen.getByLabelText("Zustand: Süditalien Rundreise"),
    ).toHaveDisplayValue("Freigegeben");
  });

  it('führt "Neue Reise" mit leeren Feldern in die Reisedetails', async () => {
    stubApi();
    await oeffneNeueReise();

    expect(
      screen.getByRole("region", { name: "Eckdaten der Reise" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Titel")).toHaveValue("");
    expect(screen.getByLabelText("Hauptort")).toHaveValue("");
    expect(screen.getByLabelText("Beginn")).toHaveValue("");
    expect(screen.getByLabelText("Ende")).toHaveValue("");
    expect(screen.getByLabelText("Beschreibung")).toHaveValue("");
  });

  it("ordnet den Anlegenden der gespeicherten Reise als Reiseleiter zu", async () => {
    stubApi();
    const user = await oeffneNeueReise();

    await user.type(screen.getByLabelText("Titel"), "Toskana 2027");
    fireEvent.change(screen.getByLabelText("Beginn"), {
      target: { value: "2027-05-12" },
    });
    fireEvent.change(screen.getByLabelText("Ende"), {
      target: { value: "2027-05-19" },
    });
    await user.type(screen.getByLabelText("Hauptort"), "Floren");
    const orte = await screen.findByRole("list", { name: "Ortsvorschläge" });
    await user.click(within(orte).getByText("Florenz"));
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getByRole("banner")).toHaveTextContent("Toskana 2027");
    expect(
      within(
        screen.getByRole("region", { name: "Wer fährt mit" }),
      ).getByLabelText("Rolle: Uwe Kremmel"),
    ).toHaveValue("reiseleiter");
  });

  it("legt keine Reise an, wenn das Anlegen abgebrochen wird", async () => {
    const fetchMock = stubApi();
    const user = await oeffneNeueReise();

    await user.type(screen.getByLabelText("Titel"), "Toskana 2027");
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));
    await user.click(
      screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
    );

    const liste = screen.getByRole("dialog", { name: "Reise wählen" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/trips", expect.anything());
  });

  it("zeigt im Aufklappmenü den Zustand jeder Reise, ohne ihn ändern zu lassen", async () => {
    const user = zeige();

    await user.click(
      screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
    );

    const liste = screen.getByRole("dialog", { name: "Reise wählen" });
    for (const trip of DEMO_TRIPS) {
      expect(
        within(liste).getByLabelText(`Zustand: ${trip.title}`),
      ).toHaveTextContent("In Planung");
    }
    expect(within(liste).queryAllByRole("combobox")).toHaveLength(0);
  });
});

/**
 * Der Bereich "Dokumente" des Planers (req-034): dass er sich oeffnet und
 * die Dokumente der geoeffneten Reise zeigt -- was er mit ihnen macht,
 * steht in dokumente-view.test.tsx.
 */
describe("PlanView, Bereich Dokumente (req-034)", () => {
  const FLUGTICKET = {
    id: "dok-1",
    tripId: DEMO_TRIPS[0].id,
    name: "Flugticket.pdf",
    contentType: "application/pdf",
    sizeBytes: 412 * 1024,
    pageCount: 1,
    poiId: null,
    transferId: null,
    uploadedById: null,
    createdAt: "2026-07-19T09:00:00.000Z",
  };

  beforeEach(() => {
    setWindowWidth(1440);
  });

  async function oeffneDokumente(documents = [FLUGTICKET]) {
    const user = userEvent.setup();
    render(<PlanView trips={DEMO_TRIPS} documents={documents} today={TODAY} />);
    await user.click(screen.getByRole("button", { name: "Dokumente" }));
    return user;
  }

  it("öffnet den Bereich und zeigt die Dokumente der geöffneten Reise", async () => {
    await oeffneDokumente();

    expect(screen.getByRole("button", { name: "Dokumente" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "Dokument ansehen: Flugticket.pdf" }),
    ).toBeInTheDocument();
  });

  it("zeigt für eine Reise ohne Dokumente den Hinweis darauf", async () => {
    await oeffneDokumente([]);

    expect(
      screen.getByText("Noch keine Dokumente abgelegt"),
    ).toBeInTheDocument();
  });

  it("zeigt die Dokumente einer anderen Reise nicht", async () => {
    const user = await oeffneDokumente();

    await user.click(
      screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
    );
    const liste = screen.getByRole("dialog", { name: "Reise wählen" });
    await user.click(
      within(liste).getByRole("button", { name: /^Wien Städtereise/ }),
    );

    expect(
      screen.getByText("Noch keine Dokumente abgelegt"),
    ).toBeInTheDocument();
  });
});

describe("POI verplanen im Bereich Planung (req-039)", () => {
  const SUEDITALIEN = DEMO_TRIPS[0];
  /** Ein POI der Reise, der noch mit keinem Programmpunkt verknüpft ist. */
  const OFFENER_POI: Poi = {
    id: "poi-neu",
    tripId: SUEDITALIEN.id,
    number: 99,
    name: "Kloster Santa Chiara",
    ort: "Neapel",
    type: "sehenswuerdigkeit",
    position: { lat: 40.8459, lng: 14.2532 },
    status: "gesetzt",
  };

  const ANGELEGT = {
    id: "activity-neu",
    tripId: SUEDITALIEN.id,
    poiId: OFFENER_POI.id,
    type: "sehenswuerdigkeit",
    title: OFFENER_POI.name,
    shortText: "",
    longText: "",
    startAt: "2026-07-20T10:00",
    endAt: "2026-07-20T12:30",
    position: OFFENER_POI.position,
  };

  beforeEach(() => {
    setWindowWidth(1440);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ activity: ANGELEGT }),
      })),
    );
  });

  async function oeffnePlanung() {
    const user = userEvent.setup();
    render(
      <PlanView
        trips={[SUEDITALIEN]}
        pois={[OFFENER_POI]}
        activities={[]}
        today={TODAY}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Planung" }));
    return user;
  }

  /** jsdom kennt kein DragEvent; React behandelt das MouseEvent gleich. */
  function ziehenAufZeitstrahl() {
    fireEvent.dragStart(screen.getByTestId(`unplanned-poi-${OFFENER_POI.id}`));
    fireEvent(
      screen.getByTestId("timeline-grid"),
      new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 96 }),
    );
  }

  it("legt den Programmpunkt an und zeigt ihn ohne Neuladen", async () => {
    await oeffnePlanung();

    ziehenAufZeitstrahl();

    expect(
      await screen.findByTestId(`activity-block-${ANGELEGT.id}`),
    ).toHaveTextContent("Kloster Santa Chiara");
  });

  it("behält den verplanten POI über den Wechsel des Bereichs hinweg", async () => {
    const user = await oeffnePlanung();
    ziehenAufZeitstrahl();
    await screen.findByTestId(`activity-block-${ANGELEGT.id}`);

    await user.click(screen.getByRole("button", { name: "POIs" }));
    await user.click(screen.getByRole("button", { name: "Planung" }));

    expect(
      screen.getByTestId(`activity-block-${ANGELEGT.id}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`unplanned-poi-${OFFENER_POI.id}`),
    ).not.toBeInTheDocument();
  });
});

describe("Programmpunkt umplanen im Bereich Planung (req-040)", () => {
  const SUEDITALIEN = DEMO_TRIPS[0];
  /** Am vorausgewaehlten Reisetag (TODAY liegt im Zeitraum der Reise). */
  const PROGRAMMPUNKT = {
    id: "activity-umplanen",
    tripId: SUEDITALIEN.id,
    type: "sehenswuerdigkeit" as const,
    title: "Kloster Santa Chiara",
    shortText: "",
    longText: "",
    startAt: "2026-07-20T10:00",
    endAt: "2026-07-20T12:30",
  };

  beforeEach(() => {
    setWindowWidth(1440);
    // Die Schnittstelle rechnet mit derselben Domaenenlogik wie die
    // Oberflaeche (siehe app/api/programmpunkte/route.ts).
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        const times = movedActivityTimes(
          PROGRAMMPUNKT,
          SUEDITALIEN,
          String(body.startAt),
        );
        return {
          ok: Boolean(times),
          status: times ? 200 : 400,
          json: async () => ({ activity: { ...PROGRAMMPUNKT, ...times } }),
        };
      }),
    );
  });

  async function oeffnePlanung() {
    const user = userEvent.setup();
    render(
      <PlanView
        trips={[SUEDITALIEN]}
        pois={[]}
        activities={[PROGRAMMPUNKT]}
        today={TODAY}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Planung" }));
    return user;
  }

  /** jsdom kennt kein DragEvent; React behandelt das MouseEvent gleich. */
  function ziehenAuf(clientY: number) {
    fireEvent.dragStart(
      screen.getByTestId(`activity-block-${PROGRAMMPUNKT.id}`),
    );
    fireEvent(
      screen.getByTestId("timeline-grid"),
      new MouseEvent("drop", { bubbles: true, cancelable: true, clientY }),
    );
  }

  it("zeigt den verschobenen Programmpunkt ohne Neuladen an seiner neuen Stelle", async () => {
    await oeffnePlanung();

    // 288 px unter dem Rasterbeginn 08:00 sind sechs Stunden: 14:00.
    ziehenAuf(6 * HOUR_HEIGHT_PX);

    await waitFor(() =>
      expect(
        screen.getByTestId(`activity-block-${PROGRAMMPUNKT.id}`),
      ).toHaveTextContent("14:00 – 16:30"),
    );
  });

  it("behält die neue Stelle über den Wechsel des Bereichs hinweg", async () => {
    const user = await oeffnePlanung();
    ziehenAuf(6 * HOUR_HEIGHT_PX);
    await waitFor(() =>
      expect(
        screen.getByTestId(`activity-block-${PROGRAMMPUNKT.id}`),
      ).toHaveTextContent("14:00 – 16:30"),
    );

    await user.click(screen.getByRole("button", { name: "POIs" }));
    await user.click(screen.getByRole("button", { name: "Planung" }));

    expect(
      screen.getByTestId(`activity-block-${PROGRAMMPUNKT.id}`),
    ).toHaveTextContent("14:00 – 16:30");
  });
});
