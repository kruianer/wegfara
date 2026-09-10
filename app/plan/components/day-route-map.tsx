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
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { MainPlace } from "@/lib/trips/types";
import type { TripDay } from "@/lib/trips/days";
import type { ActivityPosition } from "@/lib/activities/types";
import { buildDayMap } from "@/lib/map/day-map";
import { removeMap, resizeMap } from "@/lib/map/lifecycle";
import { ladeTransferVerlaeufe } from "@/lib/transfers/save-transfer";
import {
  dayTransferTotals,
  formatDayTransferTotals,
} from "@/lib/transfers/day-totals";
import { formatDayChipDate } from "@/lib/trips/format";
import styles from "./day-route-map.module.css";

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

const ROUTE_SOURCE_ID = "day-route-lines";

function readCssVar(element: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Rechte Spalte "Karte" der Planungsansicht (siehe req-011): die
 * Programmpunkte des gewaehlten Tages als nummerierte Wegpunkte in
 * zeitlicher Reihenfolge, verbunden durch eine gepunktete Linie.
 *
 * Wo ein Transfer liegt, folgt die Linie seit req-059 dem wirklichen
 * Strassenverlauf; die gepunktete Gerade bleibt, wo keiner zu haben ist --
 * ohne Transfer, bei Flug, Bahn, Boot und Faehre oder wenn der Routing-Dienst
 * schweigt. Eine Fehlermeldung erscheint auf der Karte nie.
 *
 * Eigenstaendige Karteninstanz, da Planer und Begleiter keinen Code teilen
 * (siehe stack.md, Conventions).
 */
export function DayRouteMap({
  days,
  selectedDate,
  mainPlace,
  activities,
  transfers,
  optionSelections = {},
}: {
  days: TripDay[];
  selectedDate: string;
  mainPlace: MainPlace;
  /** Programmpunkte des gewaehlten Tages. */
  activities: Activity[];
  /** Alle Transfers der Reise. */
  transfers: Transfer[];
  optionSelections?: Record<string, string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [sized, setSized] = useState(false);
  // Der Strassenverlauf je Transfer (req-059) -- was fehlt, bleibt eine
  // Gerade.
  const [verlaeufe, setVerlaeufe] = useState<
    Record<string, ActivityPosition[]>
  >({});

  function renderRoute(map: MapLibreMap, container: HTMLDivElement) {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const { markers, lines } = buildDayMap(
      activities,
      transfers,
      optionSelections,
      { verlaeufe, verbindeOhneTransfer: true },
    );

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: lines.map((line) => ({
        type: "Feature",
        properties: { gerade: line.gerade },
        geometry: {
          type: "LineString",
          coordinates: line.verlauf.map((punkt) => [punkt.lng, punkt.lat]),
        },
      })),
    };

    const source = map.getSource(ROUTE_SOURCE_ID);
    if (source) {
      (source as GeoJSONSource).setData(geojson);
    } else {
      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: geojson });
      const accent = readCssVar(container, "--acc", "#d9c589");
      map.addLayer({
        id: "day-route-line",
        type: "line",
        source: ROUTE_SOURCE_ID,
        filter: ["==", ["get", "gerade"], true],
        paint: {
          "line-color": accent,
          "line-width": 2.5,
          "line-opacity": 0.8,
          "line-dasharray": [1, 2],
        },
      });
      // Der wirkliche Streckenverlauf wird durchgezogen gezeichnet -- er ist
      // gemessen, keine Annahme (req-059).
      map.addLayer({
        id: "day-route-strasse",
        type: "line",
        source: ROUTE_SOURCE_ID,
        filter: ["==", ["get", "gerade"], false],
        paint: {
          "line-color": accent,
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });
    }

    markers.forEach(({ number, activity, position }) => {
      const el = document.createElement("div");
      el.className = styles.marker;
      el.textContent = String(number);
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", `${number}. ${activity.title}`);
      el.setAttribute("data-testid", `waypoint-marker-${activity.id}`);

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
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [mainPlace.lng, mainPlace.lat],
      zoom: 10,
    });
    mapRef.current = map;
    setSized(false);
    // Ein Frame abwarten, bevor die Groesse korrigiert wird (siehe
    // app/go/components/map-view.tsx, bug-003).
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

  // Die Transfers dieses Tages als ein Wert, der sich nur mit ihnen aendert:
  // die Karte soll den Verlauf nicht bei jedem Durchlauf neu holen.
  const tagesTransfers = buildDayMap(activities, transfers, optionSelections)
    .lines.map((line) => line.transferId)
    .filter((id): id is string => id !== null)
    .join(",");

  // Den Strassenverlauf der Transfers dieses Tages holen (req-059). Bleibt
  // er aus, zeigt die Karte die gepunktete Gerade -- ohne Fehlermeldung.
  useEffect(() => {
    const ids = tagesTransfers.split(",").filter((id) => id.length > 0);

    let verworfen = false;
    void (async () => {
      const geholt = ids.length > 0 ? await ladeTransferVerlaeufe(ids) : {};
      if (verworfen) return;

      // Nichts geholt und nichts gemerkt: den Stand lassen, wie er ist --
      // sonst zeichnet die Karte bei jedem Durchlauf neu.
      setVerlaeufe((current) =>
        Object.keys(geholt).length === 0 && Object.keys(current).length === 0
          ? current
          : geholt,
      );
    })();

    return () => {
      verworfen = true;
    };
  }, [tagesTransfers]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !sized) return;

    const applyRoute = () => renderRoute(map, container);

    // Quellen/Ebenen erst nach geladenem Stil anlegen (siehe
    // app/go/components/map-view.tsx, bug-002).
    if (map.isStyleLoaded()) {
      applyRoute();
      return;
    }
    map.once("load", applyRoute);
    return () => {
      map.off("load", applyRoute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, transfers, optionSelections, mainPlace, sized, verlaeufe]);

  const day = days.find((d) => d.date === selectedDate);
  const dayTitle = day
    ? `${day.weekday} · ${formatDayChipDate(day.date)}`
    : selectedDate;
  const totals = dayTransferTotals(activities, transfers);

  return (
    <div className={styles.column}>
      <div
        ref={containerRef}
        className={styles.map}
        data-testid="day-route-map"
      />
      <div className={styles.overlay}>
        <p className={styles.dayTitle}>{dayTitle}</p>
        <p className={styles.totals}>{formatDayTransferTotals(totals)}</p>
      </div>
    </div>
  );
}
