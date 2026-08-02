"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapLibreMap,
  Marker,
  LngLatBounds,
  type StyleSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapTouchEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Poi, PoiPosition, PoiStatus } from "@/lib/pois/types";
import type { MainPlace } from "@/lib/trips/types";
import {
  POI_STATUSES,
  POI_STATUS_COLOR,
  POI_STATUS_LABEL,
} from "@/lib/pois/status-meta";
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

const SEARCH_AREA_SOURCE_ID = "search-area";
const SEARCH_AREA_DRAFT_SOURCE_ID = "search-area-draft";
// Toleranz in Pixeln, innerhalb derer ein touchstart/touchend-Paar noch als
// Tipp gilt statt als Wisch-/Verschiebegeste (siehe bug-005).
const TOUCH_TAP_TOLERANCE_PX = 8;

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
  visibleStatuses,
  onToggleStatus,
  onSelectPoi,
  searchArea,
  onSearchAreaChange,
}: {
  pois: Poi[];
  mainPlace: MainPlace;
  /** Status, deren POIs derzeit auf der Karte erscheinen (siehe req-013). */
  visibleStatuses: PoiStatus[];
  onToggleStatus: (status: PoiStatus) => void;
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

  function renderPois(map: MapLibreMap) {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = styles.marker;
      el.setAttribute(
        "aria-label",
        `${poi.name} · ${POI_STATUS_LABEL[poi.status]}`,
      );
      el.addEventListener("click", () => onSelectPoi(poi.id));

      const drop = document.createElement("span");
      drop.className = styles.markerDrop;
      drop.style.background = POI_STATUS_COLOR[poi.status];
      drop.setAttribute("data-testid", `poi-marker-drop-${poi.id}`);
      el.appendChild(drop);

      const number = document.createElement("span");
      number.className = styles.markerNumber;
      number.setAttribute("data-testid", `poi-marker-number-${poi.id}`);
      number.textContent = String(poi.number);
      el.appendChild(number);

      markersRef.current.push(
        new Marker({ element: el, anchor: "bottom" })
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

    const applyPois = () => renderPois(map);

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
  }, [pois, mainPlace, sized]);

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

    function addDraftPoint(lngLat: { lat: number; lng: number }) {
      setDraftPoints((points) => [
        ...points,
        { lat: lngLat.lat, lng: lngLat.lng },
      ]);
    }

    function handleMapClick(e: MapMouseEvent) {
      addDraftPoint(e.lngLat);
    }

    // Auf einem Touchscreen behandelt die Kartenbibliothek eine Beruehrung
    // zunaechst als moegliche Verschiebe-/Zoom-Geste; ein kurzes Tippen
    // loest dabei kein "click"-Ereignis aus (siehe bug-005). Statt dessen
    // wird "touchstart"/"touchend" ausgewertet: bewegt sich der Finger
    // zwischen beiden Ereignissen kaum, gilt es als Eckpunkt-Tipp -- eine
    // tatsaechliche Wischgeste zum Verschieben der Karte setzt keinen Punkt.
    let touchStart: { x: number; y: number } | null = null;
    function handleTouchStart(e: MapTouchEvent) {
      touchStart = { x: e.point.x, y: e.point.y };
    }
    function handleTouchEnd(e: MapTouchEvent) {
      const start = touchStart;
      touchStart = null;
      if (!start) return;
      const moved = Math.hypot(e.point.x - start.x, e.point.y - start.y);
      if (moved > TOUCH_TAP_TOLERANCE_PX) return;
      addDraftPoint(e.lngLat);
    }

    map.on("click", handleMapClick);
    map.on("touchstart", handleTouchStart);
    map.on("touchend", handleTouchEnd);
    return () => {
      map.off("click", handleMapClick);
      map.off("touchstart", handleTouchStart);
      map.off("touchend", handleTouchEnd);
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

      <div className={styles.statusFilterPanel}>
        <div className={styles.statusFilterHeader}>Status auf der Karte</div>
        {POI_STATUSES.map((status) => (
          <label key={status} className={styles.statusFilterRow}>
            <span
              className={styles.statusFilterDot}
              style={{ background: POI_STATUS_COLOR[status] }}
              aria-hidden="true"
            />
            <span className={styles.statusFilterLabel}>
              {POI_STATUS_LABEL[status]}
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label={POI_STATUS_LABEL[status]}
              checked={visibleStatuses.includes(status)}
              onChange={() => onToggleStatus(status)}
              className={styles.statusFilterSwitch}
            />
          </label>
        ))}
      </div>

      <div className={styles.legend} data-testid="poi-legend">
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
