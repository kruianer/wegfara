import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoiMap } from "./poi-map";
import { MapLibreMap, Marker } from "@/tests/mocks/maplibre-gl";
import type { Poi, PoiPosition, PoiStatus } from "@/lib/pois/types";
import { DEFAULT_MAP_VISIBLE_STATUSES } from "@/lib/pois/status-meta";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const MAIN_PLACE = { name: "Amalfi", lat: 40.6333, lng: 14.6027 };

function poi(overrides: Partial<Poi> & { id: string }): Poi {
  return {
    tripId: "trip-1",
    number: 1,
    name: "POI",
    ort: "Ort",
    type: "sehenswuerdigkeit",
    position: { lat: 40.85, lng: 14.27 },
    status: "weiss_nicht",
    ...overrides,
  };
}

function renderMap(props: {
  pois: Poi[];
  visibleStatuses?: PoiStatus[];
  onToggleStatus?: (status: PoiStatus) => void;
  onSelectPoi?: (id: string) => void;
  searchArea?: PoiPosition[] | null;
  onSearchAreaChange?: (points: PoiPosition[] | null) => void;
}) {
  return render(
    <PoiMap
      pois={props.pois}
      mainPlace={MAIN_PLACE}
      visibleStatuses={props.visibleStatuses ?? DEFAULT_MAP_VISIBLE_STATUSES}
      onToggleStatus={props.onToggleStatus ?? (() => {})}
      onSelectPoi={props.onSelectPoi ?? (() => {})}
      searchArea={props.searchArea ?? null}
      onSearchAreaChange={props.onSearchAreaChange ?? (() => {})}
    />,
  );
}

function lastMap() {
  return MapLibreMap.instances.at(-1)!;
}

async function flushMapReady() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function twelvePois(): Poi[] {
  return Array.from({ length: 12 }, (_, i) =>
    poi({
      id: `poi-${i}`,
      number: i + 1,
      name: `POI ${i}`,
      position: { lat: 40 + i, lng: 14 + i },
    }),
  );
}

describe("PoiMap", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("zeigt fuer zwoelf POIs zwoelf Marker", async () => {
    renderMap({ pois: twelvePois() });
    await flushMapReady();

    expect(lastMap().getContainer().querySelectorAll("button")).toHaveLength(
      12,
    );
  });

  it("meldet die POI-ID beim Anklicken eines Markers", async () => {
    const user = userEvent.setup();
    const onSelectPoi = vi.fn();
    renderMap({
      pois: [poi({ id: "a", name: "Villa Rufolo" })],
      onSelectPoi,
    });
    await flushMapReady();

    const marker = screen.getByRole("button", { name: /Villa Rufolo/ });
    await user.click(marker);

    expect(onSelectPoi).toHaveBeenCalledWith("a");
  });

  it("faerbt die Flaeche des Markers in der Statusfarbe des POI", async () => {
    renderMap({
      pois: [poi({ id: "a", name: "Villa Rufolo", status: "gesetzt" })],
    });
    await flushMapReady();

    expect(screen.getByTestId("poi-marker-drop-a").style.background).toBe(
      "rgb(143, 214, 164)",
    );
  });

  it("zeigt die Nummer des POI im Marker", async () => {
    renderMap({
      pois: [poi({ id: "a", name: "Villa Rufolo", number: 7 })],
    });
    await flushMapReady();

    expect(screen.getByTestId("poi-marker-number-a")).toHaveTextContent("7");
  });

  it("ist kein einfacher Kreis, sondern aus Flaeche und Nummer zusammengesetzt", async () => {
    renderMap({ pois: [poi({ id: "a", name: "Villa Rufolo" })] });
    await flushMapReady();

    const marker = screen.getByRole("button", { name: /Villa Rufolo/ });
    // Ein einfacher Kreismarker (vor req-013) war die eingefaerbte
    // Schaltflaeche selbst, ohne Kindknoten.
    expect(marker.style.background).toBe("");
    expect(screen.getByTestId("poi-marker-drop-a")).toBeInTheDocument();
    expect(screen.getByTestId("poi-marker-number-a")).toBeInTheDocument();
  });

  it("zeigt eine Legende mit fuenf Statusfarben", async () => {
    renderMap({ pois: [] });
    await flushMapReady();

    const legend = within(screen.getByTestId("poi-legend"));
    expect(legend.getByText("Gesetzt")).toBeInTheDocument();
    expect(legend.getByText("Auf keinen Fall")).toBeInTheDocument();
  });

  it("zeigt keinen Regler Einzugsgebiet mehr", async () => {
    renderMap({ pois: [] });
    await flushMapReady();

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText("Einzugsgebiet")).not.toBeInTheDocument();
  });
});

describe("PoiMap -- Statusfilter der Karte (req-013)", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("zeigt Gesetzt und Wahrscheinlich standardmaessig als zugeschaltet", async () => {
    renderMap({ pois: [] });
    await flushMapReady();

    expect(screen.getByRole("switch", { name: "Gesetzt" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Wahrscheinlich" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Auf keinen Fall" }),
    ).not.toBeChecked();
  });

  it("meldet das Zuschalten eines Status", async () => {
    const user = userEvent.setup();
    const onToggleStatus = vi.fn();
    renderMap({ pois: [], onToggleStatus });
    await flushMapReady();

    await user.click(screen.getByRole("switch", { name: "Auf keinen Fall" }));

    expect(onToggleStatus).toHaveBeenCalledWith("auf_keinen_fall");
  });
});

function squarePoints(count: number): PoiPosition[] {
  return Array.from({ length: count }, (_, i) => ({
    lat: 40.8 + i * 0.01,
    lng: 14.2 + i * 0.01,
  }));
}

async function clickMapAt(point: PoiPosition) {
  await act(async () => {
    MapLibreMap.instances.at(-1)!.simulateClick([point.lng, point.lat]);
  });
}

describe("PoiMap -- Suchgebiet (req-012)", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("ist im Zeichenmodus erkennbar aktiv, nachdem die Zeichnen-Schaltflaeche angeklickt wurde", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();

    const button = screen.getByRole("button", {
      name: "Suchgebiet zeichnen",
    });
    await user.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Zeichnen beenden" }),
    ).toBeInTheDocument();
  });

  it("meldet beim Anklicken des ersten Punktes vier gesetzte Eckpunkte", async () => {
    const user = userEvent.setup();
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], onSearchAreaChange });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    const points = squarePoints(4);
    for (const point of points) {
      await clickMapAt(point);
    }
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet schließen" }),
    );

    expect(onSearchAreaChange).toHaveBeenCalledWith(points);
  });

  it("meldet KEINE Flaeche, wenn bei zwei gesetzten Punkten der erste erneut angeklickt wird", async () => {
    const user = userEvent.setup();
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], onSearchAreaChange });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    for (const point of squarePoints(2)) {
      await clickMapAt(point);
    }
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet schließen" }),
    );

    expect(onSearchAreaChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Zeichnen beenden" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("verwirft den Entwurf, wenn nach drei Punkten Escape gedrueckt wird", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
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
      MapLibreMap.instances.at(-1)!.getSource("search-area-draft")?.data
        .features,
    ).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("zeigt eine per Prop uebergebene Flaeche als geschlossenen Ring", async () => {
    const points = squarePoints(4);
    renderMap({ pois: [], searchArea: points });
    await flushMapReady();

    const ring = (
      MapLibreMap.instances.at(-1)!.getSource("search-area")?.data.features[0]
        ?.geometry as GeoJSON.Polygon
    ).coordinates[0];
    expect(ring).toHaveLength(5);
  });

  it("laesst die Flaeche beim Ziehen einer Ecke sofort folgen und meldet die Position beim Loslassen", async () => {
    const points = squarePoints(4);
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], searchArea: points, onSearchAreaChange });
    await flushMapReady();

    const vertex = screen.getByRole("button", { name: "Eckpunkt 1" });
    const marker = Marker.instances.find((m) => m.getElement() === vertex)!;

    await act(async () => {
      marker.simulateDragTo([20, 21], "drag");
    });
    const draggedRing = (
      MapLibreMap.instances.at(-1)!.getSource("search-area")?.data.features[0]
        ?.geometry as GeoJSON.Polygon
    ).coordinates[0];
    expect(draggedRing[0]).toEqual([20, 21]);
    expect(onSearchAreaChange).not.toHaveBeenCalled();

    await act(async () => {
      marker.simulateDragTo([22, 23], "dragend");
    });

    expect(onSearchAreaChange).toHaveBeenCalledWith([
      { lat: 23, lng: 22 },
      points[1],
      points[2],
      points[3],
    ]);
  });

  it("fuegt zwischen zwei benachbarten Ecken einen fuenften Punkt ein", async () => {
    const points = squarePoints(4);
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], searchArea: points, onSearchAreaChange });
    await flushMapReady();

    const insertHandle = screen.getAllByRole("button", {
      name: "Eckpunkt einfügen",
    })[0];
    await act(async () => {
      fireEvent.click(insertHandle);
    });

    expect(onSearchAreaChange).toHaveBeenCalledTimes(1);
    expect(onSearchAreaChange.mock.calls[0][0]).toHaveLength(5);
  });

  it("entfernt eine Ecke einer Flaeche mit fuenf Ecken", async () => {
    const points = squarePoints(5);
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], searchArea: points, onSearchAreaChange });
    await flushMapReady();

    const vertex = screen.getByRole("button", { name: "Eckpunkt 1" });
    await act(async () => {
      fireEvent.contextMenu(vertex);
    });

    expect(onSearchAreaChange).toHaveBeenCalledTimes(1);
    expect(onSearchAreaChange.mock.calls[0][0]).toHaveLength(4);
  });

  it("laesst eine Flaeche mit genau drei Ecken unveraendert, wenn eine Ecke entfernt werden soll", async () => {
    const points = squarePoints(3);
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], searchArea: points, onSearchAreaChange });
    await flushMapReady();

    const vertex = screen.getByRole("button", { name: "Eckpunkt 1" });
    await act(async () => {
      fireEvent.contextMenu(vertex);
    });

    expect(onSearchAreaChange).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("button", { name: /^Eckpunkt \d+$/ }),
    ).toHaveLength(3);
  });

  it("meldet das Entfernen der Flaeche beim Anklicken der Entfernen-Schaltflaeche", async () => {
    const user = userEvent.setup();
    const onSearchAreaChange = vi.fn();
    renderMap({
      pois: [],
      searchArea: squarePoints(4),
      onSearchAreaChange,
    });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet entfernen" }),
    );

    expect(onSearchAreaChange).toHaveBeenCalledWith(null);
  });
});
