"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapLibreMap,
  Marker,
  LngLatBounds,
  type StyleSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Poi } from "@/lib/pois/types";
import type { MainPlace } from "@/lib/trips/types";
import {
  POI_STATUSES,
  POI_STATUS_COLOR,
  POI_STATUS_LABEL,
} from "@/lib/pois/status-meta";
import { clusterPois } from "@/lib/pois/cluster";
import { buildCirclePolygon } from "@/lib/pois/circle-polygon";
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

function readCssVar(element: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
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
}: {
  pois: Poi[];
  mainPlace: MainPlace;
  radiusKm: number;
  onRadiusChange: (radiusKm: number) => void;
  onSelectPoi: (poiId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [sized, setSized] = useState(false);

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

  return (
    <div className={styles.wrap}>
      <div ref={containerRef} className={styles.map} data-testid="poi-map" />

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
