import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanView } from "./plan-view";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";
import { DEMO_POIS } from "@/tests/fixtures/demo-pois";
import { DEMO_ACTIVITIES } from "@/tests/fixtures/demo-activities";
import { DEMO_TRANSFERS } from "@/tests/fixtures/demo-transfers";
import { MapLibreMap } from "@/tests/mocks/maplibre-gl";

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
    expect(within(dialog).getAllByRole("button")).toHaveLength(3);
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

    it("zeigt auf der Karte zwoelf Kreismarker", async () => {
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);

      await flushMapReady();

      expect(
        MapLibreMap.instances.at(-1)!.getContainer().querySelectorAll("button"),
      ).toHaveLength(12);
    });

    it("hebt beim Anklicken eines Kartenmarkers den zugehoerigen POI in der Liste hervor", async () => {
      const user = userEvent.setup();
      render(<PlanView trips={DEMO_TRIPS} pois={DEMO_POIS} today={TODAY} />);
      await flushMapReady();

      const villaRufolo = DEMO_POIS.find((p) => p.name === "Villa Rufolo")!;
      const marker = screen.getByRole("button", {
        name: new RegExp(`^${villaRufolo.name} ·`),
      });
      await user.click(marker);

      expect(screen.getByTestId(`poi-row-${villaRufolo.id}`).className).toMatch(
        /rowHighlighted/,
      );
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

    it("zeigt fuer einen Reisetag mit vier Programmpunkten vier Bloecke im Zeitstrahl", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");

      expect(screen.getAllByTestId(/^activity-block-/)).toHaveLength(4);
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

    it("zeigt auf der Karte vier nummerierte Wegpunkte fuer einen Tag mit vier Programmpunkten", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");
      await flushMapReady();

      expect(screen.getAllByTestId(/^waypoint-marker-/)).toHaveLength(4);
    });

    it("zeigt beim Wechsel des Tagesreiters die Programmpunkte des gewaehlten Tages", async () => {
      const user = await openPlanung();
      await selectDay(user, "18.07.");
      expect(screen.getAllByTestId(/^activity-block-/)).toHaveLength(4);

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

      expect(screen.getAllByTestId(/^activity-block-/)).toHaveLength(4);
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
});
