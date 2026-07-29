"use client";

import { useEffect, useRef } from "react";
import {
  MapLibreMap,
  Marker,
  Popup,
  LngLatBounds,
  type StyleSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { MainPlace } from "@/lib/trips/types";
import type { TripDay } from "@/lib/trips/days";
import { buildDayMap } from "@/lib/map/day-map";
import { formatTimeRange } from "@/lib/activities/format";
import { DaySelector } from "./day-selector";
import styles from "./map-view.module.css";

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const LINES_SOURCE_ID = "transfer-lines";

function readCssVar(element: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Kartenansicht des gewaehlten Reisetages (siehe req-008). Tiles kommen von
 * OpenStreetMap statt Carto (Constraint der Vorlage), daher gibt es nur eine
 * helle Kachelvariante.
 */
export function MapView({
  days,
  selectedDate,
  onSelectDate,
  mainPlace,
  activities,
  transfers = [],
  optionSelections = {},
}: {
  days: TripDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  mainPlace: MainPlace;
  activities: Activity[];
  transfers?: Transfer[];
  optionSelections?: Record<string, string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [mainPlace.lng, mainPlace.lat],
      zoom: 12,
    });
    mapRef.current = map;
    // Der Kartenbereich wird erst beim Wechsel auf "Karte" gemountet
    // (lazy) und braucht danach eine Groessenkorrektur, weil MapLibre
    // die Canvas-Groesse bei Erstellung einmalig aus dem Container liest
    // und Aenderungen danach nicht selbst verfolgt (kein ResizeObserver).
    map.resize();
    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    popupRef.current?.remove();
    popupRef.current = null;

    const { markers, lines } = buildDayMap(
      activities,
      transfers,
      optionSelections,
    );

    const source = map.getSource(LINES_SOURCE_ID);
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: lines.map((line) => ({
        type: "Feature",
        properties: { dashed: line.mode !== "auto" },
        geometry: {
          type: "LineString",
          coordinates: [
            [line.from.lng, line.from.lat],
            [line.to.lng, line.to.lat],
          ],
        },
      })),
    };

    if (source) {
      (source as GeoJSONSource).setData(geojson);
    } else {
      map.addSource(LINES_SOURCE_ID, { type: "geojson", data: geojson });
      const lineColor = readCssVar(container, "--nav-bg", "#1a1a18");
      map.addLayer({
        id: "transfer-lines-solid",
        type: "line",
        source: LINES_SOURCE_ID,
        filter: ["==", ["get", "dashed"], false],
        paint: {
          "line-color": lineColor,
          "line-width": 3,
          "line-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "transfer-lines-dashed",
        type: "line",
        source: LINES_SOURCE_ID,
        filter: ["==", ["get", "dashed"], true],
        paint: {
          "line-color": lineColor,
          "line-width": 3,
          "line-opacity": 0.75,
          "line-dasharray": [5, 7],
        },
      });
    }

    markers.forEach(({ number, activity, position, isGroup }) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = isGroup
        ? `${styles.marker} ${styles.markerGroup}`
        : styles.marker;
      el.textContent = String(number);
      el.setAttribute("aria-label", `${number}. ${activity.title}`);
      el.addEventListener("click", () => {
        popupRef.current?.remove();

        const content = document.createElement("div");
        content.className = styles.popup;
        const title = document.createElement("p");
        title.className = styles.popupTitle;
        title.textContent = `${number}. ${activity.title}`;
        const time = document.createElement("p");
        time.className = styles.popupTime;
        time.textContent = formatTimeRange(activity);
        content.append(title, time);

        popupRef.current = new Popup({ offset: 18 })
          .setLngLat([position.lng, position.lat])
          .setDOMContent(content)
          .addTo(map);
      });

      markersRef.current.push(
        new Marker({ element: el })
          .setLngLat([position.lng, position.lat])
          .addTo(map),
      );
    });

    if (markers.length === 0) {
      map.setCenter([mainPlace.lng, mainPlace.lat]);
      return;
    }

    const bounds = new LngLatBounds();
    markers.forEach(({ position }) =>
      bounds.extend([position.lng, position.lat]),
    );
    map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
  }, [activities, transfers, optionSelections, mainPlace]);

  return (
    <div className={styles.wrap}>
      <div className={styles.dayBar}>
        <DaySelector
          days={days}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
        />
      </div>
      <div ref={containerRef} className={styles.map} data-testid="map" />
    </div>
  );
}
