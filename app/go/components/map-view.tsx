"use client";

import { useEffect, useRef, useState } from "react";
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
import { removeMap, resizeMap } from "@/lib/map/lifecycle";
import { ensureMapWorkerUrl } from "@/lib/map/worker-url";
import { formatTimeRange } from "@/lib/activities/format";
import { DaySelector } from "./day-selector";
import styles from "./map-view.module.css";

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      // tileSize 512 statt der nativen 256px laesst MapLibre eine
      // Zoomstufe hoeher anfragen und dadurch Beschriftungen auf
      // Geraeten mit doppelter Pixeldichte lesbar darstellen (bug-003) —
      // die Kachelquelle selbst liefert weiterhin nur 256px-Kacheln.
      tileSize: 512,
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
  const [sized, setSized] = useState(false);

  function renderDayMap(map: MapLibreMap, container: HTMLDivElement) {
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
  }

  useEffect(() => {
    if (!containerRef.current) return;
    // Vor der ersten Karte: ohne feste Worker-Adresse verarbeitet die
    // Kartenbibliothek keine GeoJSON-Quellen -- die Verbindungslinien
    // zwischen den Programmpunkten blieben unsichtbar (bug-013).
    ensureMapWorkerUrl();
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [mainPlace.lng, mainPlace.lat],
      zoom: 12,
    });
    mapRef.current = map;
    setSized(false);
    // Der Kartenbereich wird erst beim Wechsel auf "Karte" gemountet
    // (lazy). MapLibre liest die Canvas-Groesse bei Erstellung einmalig
    // aus dem Container und verfolgt spaetere Aenderungen nicht selbst
    // (kein ResizeObserver) — wird die Korrektur noch im selben Frame
    // aufgerufen, ist das Layout des Containers oft noch nicht
    // durchgerechnet, was verwaschene Kacheln und einen zu nahen
    // Kartenausschnitt erzeugt (bug-003). Ein Frame abwarten, bevor
    // korrigiert wird.
    const frame = requestAnimationFrame(() => {
      resizeMap(map);
      setSized(true);
    });
    const handleResize = () => resizeMap(map);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      removeMap(map);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    // Marker und Kartenausschnitt erst anlegen, nachdem die
    // Groessenkorrektur nach dem Layout erfolgt ist (bug-003) — sonst
    // rechnet fitBounds mit den noch falschen Massen und waehlt einen zu
    // nahen Zoom.
    if (!map || !container || !sized) return;

    const applyDayMap = () => {
      renderDayMap(map, container);
    };

    // Der Kartenstil laedt asynchron. Werden Quellen oder Ebenen davor
    // angelegt, schlaegt der Aufruf fehl und reisst die Kartendarstellung
    // mit (bug-002) — daher erst nach "load" bzw. bei bereits geladenem
    // Stil anlegen.
    if (map.isStyleLoaded()) {
      applyDayMap();
      return;
    }
    map.once("load", applyDayMap);
    return () => {
      map.off("load", applyDayMap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, transfers, optionSelections, mainPlace, sized]);

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
