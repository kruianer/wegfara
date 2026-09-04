import { StrictMode, useState } from "react";
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
  pickingPosition?: boolean;
  pickingLabel?: string | null;
  onPositionPicked?: (position: PoiPosition) => void;
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
      pickingPosition={props.pickingPosition ?? false}
      pickingLabel={props.pickingLabel ?? null}
      onPositionPicked={props.onPositionPicked}
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

// Klick/Tipp gehen immer an die Karte, die der Nutzer gerade bedient --
// nicht an irgendeine frueher erzeugte Instanz (siehe bug-007).
async function clickMapAt(point: PoiPosition) {
  await act(async () => {
    MapLibreMap.live().simulateClick([point.lng, point.lat]);
  });
}

async function tapMapAt(point: PoiPosition) {
  await act(async () => {
    MapLibreMap.live().simulateTouchTap([point.lng, point.lat]);
  });
}

/** Die sichtbaren Eckpunkt-Griffe des Entwurfs im Zeichenmodus. */
function draftHandles() {
  return screen.queryAllByRole("button", {
    name: /^(Eckpunkt \d+|Suchgebiet schließen)$/,
  });
}

function searchAreaRing() {
  const feature = MapLibreMap.live().getSource("search-area")?.data.features[0];
  return (feature?.geometry as GeoJSON.Polygon | undefined)?.coordinates[0];
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

  it("schliesst die Flaeche auch ohne click-Ereignis (Touchscreen)", async () => {
    // Auf einem Touchscreen erzeugt ein Tippen oft kein click-Ereignis,
    // weil die Kartenbibliothek die Beruehrung zuerst als moegliche
    // Geste deutet (bug-009). Der Griff muss daher auf pointerup
    // reagieren.
    const user = userEvent.setup();
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], onSearchAreaChange });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    for (const point of squarePoints(3)) {
      await clickMapAt(point);
    }

    const griff = screen.getByRole("button", { name: "Suchgebiet schließen" });
    fireEvent.pointerDown(griff);
    fireEvent.pointerUp(griff);

    expect(onSearchAreaChange).toHaveBeenCalled();
  });

  it("toent die entstehende Flaeche ab drei Punkten", async () => {
    // Waehrend des Zeichnens soll erkennbar sein, was im Suchgebiet
    // liegt (bug-011).
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    const punkte = squarePoints(3);
    await clickMapAt(punkte[0]);
    await clickMapAt(punkte[1]);

    const quelle = () =>
      MapLibreMap.instances.at(-1)!.getSource("search-area-draft-fill-source")
        ?.data.features ?? [];
    expect(quelle()).toHaveLength(0);

    await clickMapAt(punkte[2]);
    expect(quelle()).toHaveLength(1);
  });

  it("hebt den ersten Punkt farblich von den uebrigen ab", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    for (const point of squarePoints(3)) {
      await clickMapAt(point);
    }

    const erster = screen.getByRole("button", { name: "Suchgebiet schließen" });
    const zweiter = screen.getByRole("button", { name: "Eckpunkt 2" });
    expect(erster.className).not.toBe(zweiter.className);
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

/**
 * Eine Elternkomponente wie PoisView (siehe app/plan/components/pois-view.tsx):
 * sie haelt das gemeldete Suchgebiet im Zustand und reicht es an PoiMap
 * zurueck. Ohne diesen Rueckweg wird eine geschlossene Flaeche nie sichtbar.
 */
function StatefulPoiMap({
  initialSearchArea = null,
  onSearchAreaChange,
}: {
  initialSearchArea?: PoiPosition[] | null;
  onSearchAreaChange?: (points: PoiPosition[] | null) => void;
}) {
  const [area, setArea] = useState<PoiPosition[] | null>(initialSearchArea);
  return (
    <PoiMap
      pois={[]}
      mainPlace={MAIN_PLACE}
      visibleStatuses={DEFAULT_MAP_VISIBLE_STATUSES}
      onToggleStatus={() => {}}
      onSelectPoi={() => {}}
      searchArea={area}
      onSearchAreaChange={(points) => {
        setArea(points);
        onSearchAreaChange?.(points);
      }}
    />
  );
}

async function startDrawing() {
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Suchgebiet zeichnen" }));
}

describe("PoiMap -- Zeichnen an der lebenden Karteninstanz (bug-007)", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("setzt einen Eckpunkt, waehrend die Karte Kacheln nachlaedt", async () => {
    renderMap({ pois: [] });
    await flushMapReady();
    await startDrawing();

    // Nach dem Verschieben oder Zoomen laedt die Karte Kacheln nach und
    // meldet solange erneut "Stil nicht geladen" -- ein "load"-Ereignis
    // folgt dabei nicht mehr.
    MapLibreMap.live().simulateTileLoading();
    await clickMapAt({ lat: 40.8, lng: 14.2 });

    expect(draftHandles()).toHaveLength(1);
  });

  it("setzt vier Eckpunkte bei vier Klicks, waehrend die Karte Kacheln nachlaedt", async () => {
    renderMap({ pois: [] });
    await flushMapReady();
    await startDrawing();

    MapLibreMap.live().simulateTileLoading();
    for (const point of squarePoints(4)) {
      await clickMapAt(point);
    }

    expect(draftHandles()).toHaveLength(4);
  });

  it("zeigt eine geschlossene Flaeche, wenn nach vier Eckpunkten der erste Griff angeklickt wird", async () => {
    render(<StatefulPoiMap />);
    await flushMapReady();
    await startDrawing();

    MapLibreMap.live().simulateTileLoading();
    for (const point of squarePoints(4)) {
      await clickMapAt(point);
    }
    await act(async () => {
      // pointerup statt click: auf einem Touchscreen erzeugt ein Tippen
      // oft kein click-Ereignis (bug-009).
      fireEvent.pointerUp(
        screen.getByRole("button", { name: "Suchgebiet schließen" }),
      );
    });

    // Geschlossen heisst: der Ring endet auf seinem Anfangspunkt.
    expect(searchAreaRing()).toHaveLength(5);
    expect(
      screen.getAllByRole("button", { name: /^Eckpunkt \d+$/ }),
    ).toHaveLength(4);
  });

  it("setzt einen Eckpunkt beim Tippen auf dem Touchscreen, waehrend die Karte Kacheln nachlaedt", async () => {
    renderMap({ pois: [] });
    await flushMapReady();
    await startDrawing();

    MapLibreMap.live().simulateTileLoading();
    await tapMapAt({ lat: 40.8, lng: 14.2 });

    expect(draftHandles()).toHaveLength(1);
  });

  it("setzt einen Eckpunkt, wenn der Stil erst nach dem Klick geladen ist", async () => {
    MapLibreMap.startStyleLoaded = false;
    renderMap({ pois: [] });
    await flushMapReady();
    await startDrawing();

    await clickMapAt({ lat: 40.8, lng: 14.2 });
    await act(async () => {
      MapLibreMap.live().simulateStyleLoad();
    });

    expect(draftHandles()).toHaveLength(1);
  });

  it("zeigt die gespeicherte Flaeche nach erneutem Laden der Seite", async () => {
    // Erneutes Laden: frisch eingehaengte Komponente, Flaeche kommt als
    // Prop vom Server, der Stil ist noch nicht geladen.
    MapLibreMap.startStyleLoaded = false;
    render(<StatefulPoiMap initialSearchArea={squarePoints(4)} />);
    await flushMapReady();

    await act(async () => {
      MapLibreMap.live().simulateStyleLoad();
    });
    expect(searchAreaRing()).toHaveLength(5);

    // Und sie bleibt sichtbar, waehrend danach Kacheln nachladen.
    await act(async () => {
      MapLibreMap.live().simulateTileLoading();
      MapLibreMap.live().simulateClick([14.9, 40.9]);
    });
    expect(searchAreaRing()).toHaveLength(5);
  });

  it("setzt keinen Eckpunkt, wenn der Zeichenmodus nicht aktiv ist", async () => {
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], onSearchAreaChange });
    await flushMapReady();

    await clickMapAt({ lat: 40.8, lng: 14.2 });

    expect(draftHandles()).toHaveLength(0);
    expect(onSearchAreaChange).not.toHaveBeenCalled();
  });

  it("setzt keinen Eckpunkt mehr, nachdem das Zeichnen beendet wurde", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();
    await startDrawing();
    await clickMapAt({ lat: 40.8, lng: 14.2 });

    await user.click(screen.getByRole("button", { name: "Zeichnen beenden" }));
    await clickMapAt({ lat: 40.9, lng: 14.3 });

    expect(draftHandles()).toHaveLength(0);
  });

  it("bindet den Klick an die neue Karte, wenn die Instanz beim erneuten Einhaengen ausgetauscht wird", async () => {
    const instancesBefore = MapLibreMap.instances.length;
    // StrictMode haengt die Komponente zweimal ein: die erste Karte wird
    // abgeraeumt, die zweite ist die, die der Nutzer bedient.
    render(<StatefulPoiMap />, { wrapper: StrictMode });
    await flushMapReady();

    const created = MapLibreMap.instances.slice(instancesBefore);
    expect(created.length).toBeGreaterThan(1);
    expect(created.at(-2)!.removed).toBe(true);
    expect(created.at(-1)!.removed).toBe(false);

    await startDrawing();
    await clickMapAt({ lat: 40.8, lng: 14.2 });

    expect(draftHandles()).toHaveLength(1);
  });
});

describe("PoiMap -- Zeichnen per Finger auf dem Touchscreen (bug-005)", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("meldet beim Antippen des ersten Punktes vier gesetzte Eckpunkte", async () => {
    const user = userEvent.setup();
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], onSearchAreaChange });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    const points = squarePoints(4);
    for (const point of points) {
      await tapMapAt(point);
    }
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet schließen" }),
    );

    expect(onSearchAreaChange).toHaveBeenCalledWith(points);
  });

  it("setzt keinen Eckpunkt, wenn die Beruehrung sich wie beim Verschieben der Karte bewegt", async () => {
    renderMap({ pois: [] });
    await flushMapReady();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );

    await act(async () => {
      MapLibreMap.instances
        .at(-1)!
        .simulateTouchPan([14.2, 40.8], { x: 0, y: 0 }, { x: 60, y: 60 });
    });

    expect(
      screen.queryByRole("button", { name: "Suchgebiet schließen" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Der Unterschied zwischen "Daten gesetzt" und "Daten verarbeitet": die
 * Kartenbibliothek schneidet GeoJSON-Daten in einem Web Worker in Kacheln.
 * Ist er nicht erreichbar, nimmt setData() die Daten zwar entgegen, die
 * Karte zeichnet aber nie -- lautlos, ohne Konsolenfehler (bug-013).
 * getSource(id).data zeigt deshalb zu viel; querySourceFeatures(id) zeigt,
 * was wirklich auf der Karte ankommt.
 */
function verarbeiteteFeatures(sourceId: string) {
  return MapLibreMap.live().querySourceFeatures(sourceId);
}

function draftLinie() {
  const feature = verarbeiteteFeatures("search-area-draft")[0];
  return (feature?.geometry as GeoJSON.LineString | undefined)?.coordinates;
}

describe("PoiMap -- Linie und Flaeche werden gezeichnet (bug-013)", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("zeichnet zwischen zwei gesetzten Punkten eine Linie", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );

    const punkte = squarePoints(2);
    await clickMapAt(punkte[0]);
    expect(verarbeiteteFeatures("search-area-draft")).toHaveLength(0);

    await clickMapAt(punkte[1]);

    expect(verarbeiteteFeatures("search-area-draft")).toHaveLength(1);
    expect(draftLinie()).toEqual([
      [punkte[0].lng, punkte[0].lat],
      [punkte[1].lng, punkte[1].lat],
    ]);
  });

  it("faerbt die entstehende Flaeche ab drei Punkten ein", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );

    const punkte = squarePoints(3);
    await clickMapAt(punkte[0]);
    await clickMapAt(punkte[1]);
    expect(verarbeiteteFeatures("search-area-draft-fill-source")).toHaveLength(
      0,
    );

    await clickMapAt(punkte[2]);

    expect(verarbeiteteFeatures("search-area-draft-fill-source")).toHaveLength(
      1,
    );
  });

  it("laesst einen Entwurfspunkt am Zeiger folgen und die Linie mit ihm", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    for (const punkt of squarePoints(3)) {
      await clickMapAt(punkt);
    }

    const griff = screen.getByRole("button", { name: "Eckpunkt 2" });
    const marker = Marker.instances.find((m) => m.getElement() === griff)!;

    // Waehrend des Ziehens: die Linie folgt sofort, ohne dass der Griff
    // unter der Maus verschwindet.
    await act(async () => {
      marker.simulateDragTo([15.5, 41.5], "drag");
    });
    expect(draftLinie()?.[1]).toEqual([15.5, 41.5]);

    // Dieselbe Geste geht weiter -- der Marker lebt noch.
    await act(async () => {
      marker.simulateDragTo([15.9, 41.9], "drag");
    });
    expect(draftLinie()?.[1]).toEqual([15.9, 41.9]);

    await act(async () => {
      marker.simulateDragTo([16, 42], "dragend");
    });
    expect(draftLinie()?.[1]).toEqual([16, 42]);
  });

  it("laesst den ersten Entwurfspunkt fest, weil an ihm geschlossen wird", async () => {
    const user = userEvent.setup();
    renderMap({ pois: [] });
    await flushMapReady();
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    for (const punkt of squarePoints(3)) {
      await clickMapAt(punkt);
    }

    const griff = screen.getByRole("button", { name: "Suchgebiet schließen" });
    const marker = Marker.instances.find((m) => m.getElement() === griff)!;
    await act(async () => {
      marker.simulateDragTo([16, 42]);
    });

    expect(draftLinie()?.[0]).toEqual([
      squarePoints(3)[0].lng,
      squarePoints(3)[0].lat,
    ]);
  });

  it("zeichnet eine geschlossene Flaeche auch nach erneutem Laden der Seite", async () => {
    renderMap({ pois: [], searchArea: squarePoints(4) });
    await flushMapReady();

    expect(verarbeiteteFeatures("search-area")).toHaveLength(1);
  });

  it("laesst eine geschlossene Flaeche beim Ziehen einer Ecke ueber die ganze Geste folgen", async () => {
    const points = squarePoints(4);
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], searchArea: points, onSearchAreaChange });
    await flushMapReady();

    const griff = screen.getByRole("button", { name: "Eckpunkt 1" });
    const marker = Marker.instances.find((m) => m.getElement() === griff)!;

    await act(async () => {
      marker.simulateDragTo([20, 21], "drag");
    });
    await act(async () => {
      marker.simulateDragTo([21, 22], "drag");
    });
    const ring = (
      verarbeiteteFeatures("search-area")[0]?.geometry as GeoJSON.Polygon
    ).coordinates[0];
    expect(ring[0]).toEqual([21, 22]);

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

  it("meldet den Klick als Position, sobald ein Formular darauf wartet", async () => {
    const onPositionPicked = vi.fn();
    renderMap({ pois: [], pickingPosition: true, onPositionPicked });
    await flushMapReady();

    await clickMapAt({ lat: 40.6117, lng: 14.5289 });

    expect(onPositionPicked).toHaveBeenCalledWith({
      lat: 40.6117,
      lng: 14.5289,
    });
  });

  it("meldet auch einen Tipp mit dem Finger als Position (bug-005)", async () => {
    const onPositionPicked = vi.fn();
    renderMap({ pois: [], pickingPosition: true, onPositionPicked });
    await flushMapReady();

    await tapMapAt({ lat: 40.6117, lng: 14.5289 });

    expect(onPositionPicked).toHaveBeenCalledWith({
      lat: 40.6117,
      lng: 14.5289,
    });
  });

  it("laesst einen Klick auf einen Marker nicht als Kartenklick durch", async () => {
    // Die Kartenbibliothek hoert an der Kartenflaeche mit; ein Marker liegt
    // darin. Ohne Anhalten waere der Klick auf einen Marker zugleich ein
    // Klick auf die Stelle unter ihm (bug-015).
    const onSelectPoi = vi.fn();
    renderMap({ pois: [poi({ id: "poi-1" })], onSelectPoi });
    await flushMapReady();
    const flaeche = lastMap().getContainer();
    const alsKartenklick = vi.fn();
    flaeche.addEventListener("click", alsKartenklick);

    fireEvent.click(flaeche.querySelectorAll("button")[0]);

    expect(onSelectPoi).toHaveBeenCalledWith("poi-1");
    expect(alsKartenklick).not.toHaveBeenCalled();
  });

  it("laesst einen Klick auf einen Griff des Suchgebiets nicht durch", async () => {
    const onSearchAreaChange = vi.fn();
    renderMap({ pois: [], searchArea: squarePoints(3), onSearchAreaChange });
    await flushMapReady();
    const flaeche = lastMap().getContainer();
    const alsKartenklick = vi.fn();
    flaeche.addEventListener("click", alsKartenklick);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Eckpunkt einfügen" })[0],
    );

    expect(onSearchAreaChange).toHaveBeenCalled();
    expect(alsKartenklick).not.toHaveBeenCalled();
  });

  it("nennt im Hinweis den POI, dessen Position gesetzt wird", async () => {
    renderMap({
      pois: [],
      pickingPosition: true,
      pickingLabel: "Villa Rufolo",
    });
    await flushMapReady();

    expect(screen.getByTestId("poi-map-position-modus")).toHaveTextContent(
      "Villa Rufolo",
    );
  });

  it("laesst waehrend des Wartens auf eine Position weiter zeichnen", async () => {
    const user = userEvent.setup();
    const onPositionPicked = vi.fn();
    renderMap({ pois: [], pickingPosition: true, onPositionPicked });
    await flushMapReady();

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    await clickMapAt({ lat: 40.6117, lng: 14.5289 });

    // Der Klick gehoert dem Zeichnen; das Formular bekommt ihn nicht.
    expect(onPositionPicked).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("poi-map-position-modus"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Suchgebiet schließen" }),
    ).toBeInTheDocument();
  });

  it("wartet nach dem Ende des Zeichnens wieder auf eine Position", async () => {
    const user = userEvent.setup();
    const onPositionPicked = vi.fn();
    renderMap({ pois: [], pickingPosition: true, onPositionPicked });
    await flushMapReady();
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );

    await user.click(screen.getByRole("button", { name: "Zeichnen beenden" }));
    await clickMapAt({ lat: 40.6117, lng: 14.5289 });

    expect(onPositionPicked).toHaveBeenCalledWith({
      lat: 40.6117,
      lng: 14.5289,
    });
  });

  it("loescht die getoente Entwurfsflaeche, sobald das Suchgebiet geschlossen ist", async () => {
    const user = userEvent.setup();
    render(<StatefulPoiMap />);
    await flushMapReady();
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    for (const punkt of squarePoints(3)) {
      await clickMapAt(punkt);
    }
    await user.click(
      screen.getByRole("button", { name: "Suchgebiet schließen" }),
    );

    expect(verarbeiteteFeatures("search-area-draft")).toHaveLength(0);
    expect(verarbeiteteFeatures("search-area-draft-fill-source")).toHaveLength(
      0,
    );
    expect(verarbeiteteFeatures("search-area")).toHaveLength(1);
  });
});
