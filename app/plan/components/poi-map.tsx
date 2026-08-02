"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapLibreMap,
  Marker,
  LngLatBounds,
  type StyleSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Poi, PoiPosition } from "@/lib/pois/types";
import type { MainPlace } from "@/lib/trips/types";
import {
  POI_STATUSES,
  POI_STATUS_COLOR,
  POI_STATUS_LABEL,
} from "@/lib/pois/status-meta";
import { clusterPois } from "@/lib/pois/cluster";
import { buildCirclePolygon } from "@/lib/pois/circle-polygon";
import {
  MIN_SEARCH_AREA_POINTS,
  canRemovePoint,
  edgeMidpoints,
  insertMidpoint,
  movePointAt,
  removePointAt,
  toLineGeometry,
  toPolygonGeometry,
} from "@/lib/pois/search-area";
import styles from "./poi-map.module.css";

export const RADIUS_MIN_KM = 10;
export const RADIUS_MAX_KM = 150;
export const RADIUS_STEP_KM = 5;

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      // tileSize 512 statt der nativen 256px (siehe app/go/components/map-view.tsx, bug-003).
      tileSize: 512,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const CLUSTER_SOURCE_ID = "poi-clusters";
const SEARCH_AREA_SOURCE_ID = "search-area";
const SEARCH_AREA_DRAFT_SOURCE_ID = "search-area-draft";

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function featureCollection(
  geometry: GeoJSON.Geometry,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry }],
  };
}

function readCssVar(element: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

function setSourceData(
  map: MapLibreMap,
  id: string,
  data: GeoJSON.FeatureCollection,
) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

/** Legt Quelle und Ebenen des Suchgebiets an, sofern noch nicht vorhanden. */
function ensureSearchAreaLayers(map: MapLibreMap, accent: string) {
  if (!map.getSource(SEARCH_AREA_SOURCE_ID)) {
    map.addSource(SEARCH_AREA_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    });
    map.addLayer({
      id: "search-area-fill",
      type: "fill",
      source: SEARCH_AREA_SOURCE_ID,
      paint: { "fill-color": accent, "fill-opacity": 0.16 },
    });
    map.addLayer({
      id: "search-area-outline",
      type: "line",
      source: SEARCH_AREA_SOURCE_ID,
      paint: { "line-color": accent, "line-width": 2 },
    });
  }
  if (!map.getSource(SEARCH_AREA_DRAFT_SOURCE_ID)) {
    map.addSource(SEARCH_AREA_DRAFT_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    });
    map.addLayer({
      id: "search-area-draft-line",
      type: "line",
      source: SEARCH_AREA_DRAFT_SOURCE_ID,
      paint: {
        "line-color": accent,
        "line-width": 2,
        "line-dasharray": [2, 2],
      },
    });
  }
}

/**
 * Kartenansicht der POIs einer Reise (siehe req-010). Eigenstaendige
 * Karteninstanz getrennt von app/go/components/map-view.tsx -- Planer und
 * Begleiter teilen keinen Code (siehe stack.md, Conventions).
 */
export function PoiMap({
  pois,
  mainPlace,
  radiusKm,
  onRadiusChange,
  onSelectPoi,
  searchArea,
  onSearchAreaChange,
}: {
  pois: Poi[];
  mainPlace: MainPlace;
  radiusKm: number;
  onRadiusChange: (radiusKm: number) => void;
  onSelectPoi: (poiId: string) => void;
  searchArea: PoiPosition[] | null;
  onSearchAreaChange: (points: PoiPosition[] | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const searchAreaMarkersRef = useRef<Marker[]>([]);
  const [sized, setSized] = useState(false);

  const [drawMode, setDrawMode] = useState<"idle" | "drawing">("idle");
  const [draftPoints, setDraftPoints] = useState<PoiPosition[]>([]);
  const [editPoints, setEditPoints] = useState<PoiPosition[] | null>(
    searchArea,
  );
  // Uebernimmt ein von aussen (Reisewechsel, initiales Laden) geaendertes
  // Suchgebiet waehrend des Renderns statt in einem Effect (siehe
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [syncedSearchArea, setSyncedSearchArea] = useState(searchArea);
  if (searchArea !== syncedSearchArea) {
    setSyncedSearchArea(searchArea);
    setEditPoints(searchArea);
  }

  function renderPois(map: MapLibreMap, container: HTMLDivElement) {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const clusters = clusterPois(pois, radiusKm);
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: clusters.map((cluster) => ({
        type: "Feature",
        properties: { members: cluster.members.length },
        geometry: buildCirclePolygon(cluster.position, cluster.radiusKm),
      })),
    };

    const source = map.getSource(CLUSTER_SOURCE_ID);
    if (source) {
      (source as GeoJSONSource).setData(geojson);
    } else {
      map.addSource(CLUSTER_SOURCE_ID, { type: "geojson", data: geojson });
      const accent = readCssVar(container, "--acc", "#d9c589");
      map.addLayer({
        id: "poi-cluster-fill",
        type: "fill",
        source: CLUSTER_SOURCE_ID,
        paint: { "fill-color": accent, "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "poi-cluster-outline",
        type: "line",
        source: CLUSTER_SOURCE_ID,
        paint: {
          "line-color": accent,
          "line-width": 1.2,
          "line-opacity": 0.5,
          "line-dasharray": [2, 7],
        },
      });
    }

    pois.forEach((poi) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = styles.marker;
      el.style.background = POI_STATUS_COLOR[poi.status];
      el.setAttribute(
        "aria-label",
        `${poi.name} · ${POI_STATUS_LABEL[poi.status]}`,
      );
      el.addEventListener("click", () => onSelectPoi(poi.id));

      markersRef.current.push(
        new Marker({ element: el })
          .setLngLat([poi.position.lng, poi.position.lat])
          .addTo(map),
      );
    });

    if (pois.length === 0) {
      map.setCenter([mainPlace.lng, mainPlace.lat]);
      return;
    }

    const bounds = new LngLatBounds();
    pois.forEach(({ position }) => bounds.extend([position.lng, position.lat]));
    map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
  }

  function attemptClosePolygon() {
    if (draftPoints.length < MIN_SEARCH_AREA_POINTS) return;
    onSearchAreaChange(draftPoints);
    setDrawMode("idle");
    setDraftPoints([]);
  }

  function renderSearchArea(map: MapLibreMap, container: HTMLDivElement) {
    searchAreaMarkersRef.current.forEach((marker) => marker.remove());
    searchAreaMarkersRef.current = [];

    const accent = readCssVar(container, "--acc", "#d9c589");
    ensureSearchAreaLayers(map, accent);

    if (drawMode === "drawing") {
      setSourceData(map, SEARCH_AREA_SOURCE_ID, EMPTY_FEATURE_COLLECTION);
      setSourceData(
        map,
        SEARCH_AREA_DRAFT_SOURCE_ID,
        draftPoints.length >= 2
          ? featureCollection(toLineGeometry(draftPoints))
          : EMPTY_FEATURE_COLLECTION,
      );

      draftPoints.forEach((point, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = styles.vertexHandle;
        el.setAttribute(
          "aria-label",
          index === 0 ? "Suchgebiet schließen" : `Eckpunkt ${index + 1}`,
        );
        if (index === 0) {
          el.addEventListener("click", attemptClosePolygon);
        }
        searchAreaMarkersRef.current.push(
          new Marker({ element: el })
            .setLngLat([point.lng, point.lat])
            .addTo(map),
        );
      });
      return;
    }

    setSourceData(map, SEARCH_AREA_DRAFT_SOURCE_ID, EMPTY_FEATURE_COLLECTION);

    if (!editPoints) {
      setSourceData(map, SEARCH_AREA_SOURCE_ID, EMPTY_FEATURE_COLLECTION);
      return;
    }

    setSourceData(
      map,
      SEARCH_AREA_SOURCE_ID,
      featureCollection(toPolygonGeometry(editPoints)),
    );

    edgeMidpoints(editPoints).forEach((mid, edgeIndex) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = styles.midpointHandle;
      el.setAttribute("aria-label", "Eckpunkt einfügen");
      el.addEventListener("click", () => {
        const next = insertMidpoint(editPoints, edgeIndex);
        setEditPoints(next);
        onSearchAreaChange(next);
      });
      searchAreaMarkersRef.current.push(
        new Marker({ element: el }).setLngLat([mid.lng, mid.lat]).addTo(map),
      );
    });

    editPoints.forEach((point, index) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = styles.vertexHandle;
      el.setAttribute("aria-label", `Eckpunkt ${index + 1}`);
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (!canRemovePoint(editPoints)) return;
        const next = removePointAt(editPoints, index);
        setEditPoints(next);
        onSearchAreaChange(next);
      });

      const marker = new Marker({ element: el, draggable: true })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      marker.on("drag", () => {
        const { lng, lat } = marker.getLngLat();
        setEditPoints(movePointAt(editPoints, index, { lat, lng }));
      });
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        const next = movePointAt(editPoints, index, { lat, lng });
        setEditPoints(next);
        onSearchAreaChange(next);
      });

      searchAreaMarkersRef.current.push(marker);
    });
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [mainPlace.lng, mainPlace.lat],
      zoom: 8,
    });
    mapRef.current = map;
    setSized(false);
    // Ein Frame abwarten, bevor die Groesse korrigiert wird (siehe
    // app/go/components/map-view.tsx, bug-003).
    const frame = requestAnimationFrame(() => {
      map.resize();
      setSized(true);
    });
    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !sized) return;

    const applyPois = () => renderPois(map, container);

    // Quellen/Ebenen erst nach geladenem Stil anlegen (siehe
    // app/go/components/map-view.tsx, bug-002).
    if (map.isStyleLoaded()) {
      applyPois();
      return;
    }
    map.once("load", applyPois);
    return () => {
      map.off("load", applyPois);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois, radiusKm, mainPlace, sized]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !sized) return;

    const applySearchArea = () => renderSearchArea(map, container);

    if (map.isStyleLoaded()) {
      applySearchArea();
      return;
    }
    map.once("load", applySearchArea);
    return () => {
      map.off("load", applySearchArea);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPoints, drawMode, draftPoints, sized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || drawMode !== "drawing") return;

    function handleMapClick(e: MapMouseEvent) {
      setDraftPoints((points) => [
        ...points,
        { lat: e.lngLat.lat, lng: e.lngLat.lng },
      ]);
    }
    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [drawMode]);

  useEffect(() => {
    if (drawMode !== "drawing") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawMode("idle");
        setDraftPoints([]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawMode]);

  function toggleDrawMode() {
    setDrawMode((mode) => (mode === "drawing" ? "idle" : "drawing"));
    setDraftPoints([]);
  }

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={
          drawMode === "drawing"
            ? `${styles.map} ${styles.mapDrawing}`
            : styles.map
        }
        data-testid="poi-map"
      />

      <div className={styles.drawPanel}>
        <button
          type="button"
          aria-pressed={drawMode === "drawing"}
          className={
            drawMode === "drawing"
              ? `${styles.drawButton} ${styles.drawButtonActive}`
              : styles.drawButton
          }
          onClick={toggleDrawMode}
        >
          {drawMode === "drawing" ? "Zeichnen beenden" : "Suchgebiet zeichnen"}
        </button>
        {drawMode === "idle" && editPoints && (
          <button
            type="button"
            className={styles.drawButton}
            onClick={() => onSearchAreaChange(null)}
          >
            Suchgebiet entfernen
          </button>
        )}
        {drawMode === "drawing" && (
          <p className={styles.drawHint}>
            Zeichenmodus aktiv — Punkte auf der Karte setzen, den ersten Punkt
            erneut anklicken zum Schließen, Escape bricht ab.
          </p>
        )}
      </div>

      <div className={styles.radiusPanel}>
        <div className={styles.radiusHeader}>
          <span className={styles.radiusLabel}>Einzugsgebiet</span>
          <span className={styles.radiusValue}>{radiusKm} km</span>
        </div>
        <input
          type="range"
          min={RADIUS_MIN_KM}
          max={RADIUS_MAX_KM}
          step={RADIUS_STEP_KM}
          value={radiusKm}
          aria-label="Einzugsgebiet"
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className={styles.radiusSlider}
        />
        <p className={styles.radiusHint}>
          Cluster-Radius für Karten-Zonen. Autoreise: großzügig · Städtereise:
          klein.
        </p>
      </div>

      <div className={styles.legend}>
        {POI_STATUSES.map((status) => (
          <div key={status} className={styles.legendRow}>
            <span
              className={styles.legendDot}
              style={{ background: POI_STATUS_COLOR[status] }}
              aria-hidden="true"
            />
            {POI_STATUS_LABEL[status]}
          </div>
        ))}
      </div>
    </div>
  );
}
