import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoiMap } from "./poi-map";
import { MapLibreMap } from "@/tests/mocks/maplibre-gl";
import type { Poi } from "@/lib/pois/types";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const MAIN_PLACE = { name: "Amalfi", lat: 40.6333, lng: 14.6027 };

function poi(overrides: Partial<Poi> & { id: string }): Poi {
  return {
    tripId: "trip-1",
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
  radiusKm?: number;
  onRadiusChange?: (km: number) => void;
  onSelectPoi?: (id: string) => void;
}) {
  return render(
    <PoiMap
      pois={props.pois}
      mainPlace={MAIN_PLACE}
      radiusKm={props.radiusKm ?? 60}
      onRadiusChange={props.onRadiusChange ?? (() => {})}
      onSelectPoi={props.onSelectPoi ?? (() => {})}
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
      name: `POI ${i}`,
      position: { lat: 40 + i, lng: 14 + i },
    }),
  );
}

describe("PoiMap", () => {
  afterEach(() => {
    MapLibreMap.startStyleLoaded = true;
  });

  it("zeigt fuer zwoelf POIs zwoelf Kreismarker", async () => {
    renderMap({ pois: twelvePois() });
    await flushMapReady();

    expect(lastMap().getContainer().querySelectorAll("button")).toHaveLength(
      12,
    );
  });

  it("legt fuer zwei nah beieinander liegende POIs eine gestrichelte Cluster-Zone an", async () => {
    const pois = [
      poi({ id: "a", position: { lat: 40.8518, lng: 14.2681 } }),
      poi({ id: "b", position: { lat: 40.8467, lng: 14.2497 } }),
    ];
    renderMap({ pois, radiusKm: 60 });
    await flushMapReady();

    const map = lastMap();
    const source = map.getSource("poi-clusters");
    expect(source?.data.features).toHaveLength(1);
    const outline = map.getLayer("poi-cluster-outline") as {
      paint?: Record<string, unknown>;
    };
    expect(outline?.paint?.["line-dasharray"]).toEqual([2, 7]);
  });

  it("legt keine Cluster-Zone an, wenn kein POI-Paar nah genug beieinander liegt", async () => {
    const pois = [
      poi({ id: "a", position: { lat: 40.85, lng: 14.27 } }),
      poi({ id: "b", position: { lat: 48.21, lng: 16.37 } }),
    ];
    renderMap({ pois, radiusKm: 60 });
    await flushMapReady();

    const source = lastMap().getSource("poi-clusters");
    expect(source?.data.features).toHaveLength(0);
  });

  it("verkleinert die Cluster-Zone, wenn das Einzugsgebiet verkleinert wird", async () => {
    const pois = [
      poi({ id: "a", position: { lat: 40.8518, lng: 14.2681 } }),
      poi({ id: "b", position: { lat: 40.8467, lng: 14.2497 } }),
      poi({ id: "c", position: { lat: 41.9028, lng: 12.4964 } }),
    ];
    const { rerender } = renderMap({ pois, radiusKm: 250 });
    await flushMapReady();
    const map = lastMap();
    const largeFeatures = map.getSource("poi-clusters")?.data
      .features as GeoJSON.Feature[];
    const largeRing = (largeFeatures[0].geometry as GeoJSON.Polygon)
      .coordinates[0];
    const largeLngSpan =
      Math.max(...largeRing.map((c) => c[0])) -
      Math.min(...largeRing.map((c) => c[0]));

    rerender(
      <PoiMap
        pois={pois}
        mainPlace={MAIN_PLACE}
        radiusKm={10}
        onRadiusChange={() => {}}
        onSelectPoi={() => {}}
      />,
    );
    await flushMapReady();

    const smallFeatures = map.getSource("poi-clusters")?.data
      .features as GeoJSON.Feature[];
    const smallRing = (smallFeatures[0].geometry as GeoJSON.Polygon)
      .coordinates[0];
    const smallLngSpan =
      Math.max(...smallRing.map((c) => c[0])) -
      Math.min(...smallRing.map((c) => c[0]));

    expect(smallLngSpan).toBeLessThan(largeLngSpan);
  });

  it("meldet die POI-ID beim Anklicken eines Kreismarkers", async () => {
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

  it("faerbt den Marker in der Statusfarbe des POI", async () => {
    renderMap({
      pois: [poi({ id: "a", name: "Villa Rufolo", status: "gesetzt" })],
    });
    await flushMapReady();

    const marker = screen.getByRole("button", { name: /Villa Rufolo/ });
    expect(marker.style.background).toBe("rgb(143, 214, 164)");
  });

  it("zeigt eine Legende mit fuenf Statusfarben", async () => {
    renderMap({ pois: [] });
    await flushMapReady();

    expect(screen.getByText("Gesetzt")).toBeInTheDocument();
    expect(screen.getByText("Auf keinen Fall")).toBeInTheDocument();
  });

  it("meldet den neuen Radius beim Verschieben des Reglers", async () => {
    const onRadiusChange = vi.fn();
    renderMap({ pois: [], onRadiusChange });
    await flushMapReady();

    const slider = screen.getByRole("slider", { name: "Einzugsgebiet" });
    fireEvent.change(slider, { target: { value: "30" } });

    expect(onRadiusChange).toHaveBeenCalledWith(30);
  });
});
