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
  const markersRef = useRef<Marker[]>([]);
  const searchAreaMarkersRef = useRef<Marker[]>([]);
  // Die Karteninstanz liegt im Zustand, nicht in einer Referenz (siehe
  // bug-007): nur so laufen die abhaengigen Effekte erneut, sobald die
  // Instanz entsteht oder ausgetauscht wird -- eine Referenz aendert sich
  // ohne erneutes Rendern und laesst die Effekte auf einer Instanz
  // arbeiten, die der Nutzer gar nicht mehr bedient.
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [sized, setSized] = useState(false);
  // Der Stil gilt ab dem einmaligen "load"-Ereignis als nutzbar. NICHT
  // isStyleLoaded() bei jedem Effektlauf abfragen (siehe bug-007): das
  // meldet auch nach geladenem Stil wieder false, solange Kacheln
  // nachgeladen werden -- ein danach registriertes once("load") feuert nie
  // mehr, und die Darstellung bliebe fuer immer aus.
  const [styleReady, setStyleReady] = useState(false);

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
        el.className =
          index === 0
            ? `${styles.vertexHandle} ${styles.vertexHandleFirst}`
            : styles.vertexHandle;
        el.setAttribute(
          "aria-label",
          index === 0 ? "Suchgebiet schließen" : `Eckpunkt ${index + 1}`,
        );
        if (index === 0) {
          // "pointerup" statt "click": auf einem Touchscreen deutet die
          // Kartenbibliothek eine Beruehrung zuerst als moegliche Geste,
          // ein Tippen erzeugt dabei oft kein click-Ereignis (siehe
          // bug-005). Der Kartenklick setzte stattdessen einen weiteren
          // Punkt, statt die Flaeche zu schliessen (bug-009).
          el.addEventListener("pointerup", (event) => {
            event.preventDefault();
            event.stopPropagation();
            attemptClosePolygon();
          });
          // Verhindert, dass die Beruehrung als Kartenklick durchschlaegt.
          el.addEventListener("pointerdown", (event) => {
            event.stopPropagation();
          });
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
    const container = containerRef.current;
    if (!container) return;
    const instance = new MapLibreMap({
      container,
      style: OSM_STYLE,
      center: [mainPlace.lng, mainPlace.lat],
      zoom: 8,
    });
    setSized(false);
    setStyleReady(false);

    // Der Stil-Zustand wird an genau der Stelle beobachtet, an der die
    // Instanz entsteht -- so gehoert er zu ihrem Lebenszyklus und kann
    // nicht auf eine andere Instanz treffen (siehe bug-007).
    const markStyleReady = () => setStyleReady(true);
    if (instance.isStyleLoaded()) {
      markStyleReady();
    } else {
      instance.once("load", markStyleReady);
    }
    setMap(instance);

    // Ein Frame abwarten, bevor die Groesse korrigiert wird (siehe
    // app/go/components/map-view.tsx, bug-003).
    const frame = requestAnimationFrame(() => {
      instance.resize();
      setSized(true);
    });
    const handleResize = () => instance.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      instance.off("load", markStyleReady);
      instance.remove();
      setMap(null);
      setStyleReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Quellen/Ebenen erst nach geladenem Stil anlegen (siehe
    // app/go/components/map-view.tsx, bug-002).
    if (!map || !styleReady || !sized) return;
    renderPois(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady, sized, pois, mainPlace]);

  useEffect(() => {
    const container = containerRef.current;
    if (!map || !container || !styleReady || !sized) return;
    renderSearchArea(map, container);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady, sized, editPoints, drawMode, draftPoints]);

  useEffect(() => {
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
  }, [map, drawMode]);

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
            Zeichenmodus aktiv — Punkte auf der Karte setzen, den grünen
            Punkt antippen zum Schließen (ab drei Punkten), Escape bricht
            ab.
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
