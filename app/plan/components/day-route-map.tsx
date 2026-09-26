"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import { routenPfeile, type RoutenPfeil } from "@/lib/map/pfeile";
import { ROUTEN_FARBE } from "@/lib/map/routenfarbe";
import { removeMap, resizeMap } from "@/lib/map/lifecycle";
import { ladeTransferVerlaeufe } from "@/lib/transfers/save-transfer";
import {
  dayTransferTotals,
  formatDayTransferTotals,
} from "@/lib/transfers/day-totals";
import { formatDayChipDate } from "@/lib/trips/format";
import { RoutenPfeilIcon } from "@/components/icons";
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

/**
 * Der Vorgabewert fuer die Wahl je Options-Gruppe -- ein Wert, nicht bei
 * jedem Rendern ein neuer. Als `= {}` in der Signatur haenge daran der
 * Effekt, der die Linien zeichnet: er liefe bei jedem Durchlauf erneut und
 * rueckte den Ausschnitt jedes Mal zurecht (bug-048, req-075).
 */
const KEINE_OPTIONSWAHL: Record<string, string> = {};

/** Dasselbe fuer die POI-Nummern (bug-055): ein Wert, nicht jedes Mal ein neuer. */
const KEINE_POI_NUMMERN: Map<string, number> = new Map();

/**
 * Was ein Richtungspfeil einem Vorlesegeraet sagt (req-075) -- dieselben
 * POI-Nummern, die auch seine beiden Marker tragen (bug-055). Fehlt an einem
 * Ende eine, nennt er keine: eine Zahl aus einer anderen Zaehlung waere dort
 * falsch zu lesen.
 */
function pfeilBeschriftung({
  vonPoiNummer,
  nachPoiNummer,
}: RoutenPfeil): string {
  if (vonPoiNummer === null || nachPoiNummer === null) {
    return "Pfeil in Wegrichtung";
  }
  return `Pfeil von POI ${vonPoiNummer} nach POI ${nachPoiNummer}`;
}

/**
 * Rechte Spalte "Karte" der Planungsansicht (siehe req-011): die
 * Programmpunkte des gewaehlten Tages als Wegpunkte in zeitlicher Reihenfolge,
 * verbunden durch eine gepunktete Linie.
 *
 * Die Zahl an einem Wegpunkt ist seine POI-Nummer (bug-055) -- dieselbe, die
 * die POI-Liste, die Auswahlliste und der Zeitstrahl daneben zeigen (req-013,
 * req-074). Ein Programmpunkt ohne POI traegt keine: er wird als Punkt
 * gezeichnet, denn jede Zahl an seiner Stelle waere als POI-Nummer zu lesen.
 * Die Reihenfolge des Tages sagen der Zeitstrahl und die Richtungspfeile.
 *
 * Wo ein Transfer liegt, folgt die Linie seit req-059 dem wirklichen
 * Strassenverlauf; die gepunktete Gerade bleibt, wo keiner zu haben ist --
 * ohne Transfer, bei Flug, Bahn, Boot und Faehre oder wenn der Routing-Dienst
 * schweigt. Eine Fehlermeldung erscheint auf der Karte nie.
 *
 * Auf Wunsch traegt jede dieser Linien seit req-075 einen Pfeil, der sagt,
 * wohin es geht -- eingeschaltet ueber den Schalter oben rechts, beim Oeffnen
 * aus. Er zeichnet nichts neben die Linien, sondern auf sie (siehe
 * lib/map/pfeile.ts).
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
  optionSelections = KEINE_OPTIONSWAHL,
  poiNummern = KEINE_POI_NUMMERN,
}: {
  days: TripDay[];
  selectedDate: string;
  mainPlace: MainPlace;
  /** Programmpunkte des gewaehlten Tages. */
  activities: Activity[];
  /** Alle Transfers der Reise. */
  transfers: Transfer[];
  optionSelections?: Record<string, string>;
  /**
   * Die Nummern der POIs der Reise nach ihrer Kennung (req-074) -- daraus
   * bekommt jeder Wegpunkt seine Zahl (bug-055).
   */
  poiNummern?: Map<string, number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  // Die Richtungspfeile liegen in einer eigenen Liste (req-075): sie kommen
  // und gehen mit dem Schalter, waehrend die Wegpunkte stehen bleiben.
  const pfeilMarkersRef = useRef<Marker[]>([]);
  const [sized, setSized] = useState(false);
  // Ob die Pfeile gezeigt werden. Beim Oeffnen aus; wer sie einschaltet,
  // behaelt sie -- auch ueber einen Wechsel des Reisetages hinweg, denn die
  // Karte bleibt dabei stehen (req-075).
  const [pfeileAn, setPfeileAn] = useState(false);
  // Der Strassenverlauf je Transfer (req-059) -- was fehlt, bleibt eine
  // Gerade.
  const [verlaeufe, setVerlaeufe] = useState<
    Record<string, ActivityPosition[]>
  >({});

  function renderRoute(map: MapLibreMap) {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const { markers, lines } = buildDayMap(
      activities,
      transfers,
      optionSelections,
      { verlaeufe, verbindeOhneTransfer: true, poiNummern },
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
      // Die Farbe der Wege steht in lib/map/routenfarbe.ts und nicht mehr in
      // der CSS-Variablen --acc der Oberflaeche (bug-059): der Akzent des
      // Planers gehoert dem dunklen Grund der App, die Karte darunter ist hell.
      // Deckend gezeichnet -- die 0,8 bzw. 0,9 davor sollten die Linie auf
      // dunklem Grund daempfen und nahmen ihr auf hellem den Kontrast.
      map.addLayer({
        id: "day-route-line",
        type: "line",
        source: ROUTE_SOURCE_ID,
        filter: ["==", ["get", "gerade"], true],
        paint: {
          "line-color": ROUTEN_FARBE,
          "line-width": 2.5,
          "line-opacity": 1,
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
          "line-color": ROUTEN_FARBE,
          "line-width": 3,
          "line-opacity": 1,
        },
      });
    }

    markers.forEach(({ poiNummer, activity, position }) => {
      const el = document.createElement("div");
      // Ohne POI keine Nummer (bug-055): ein von Hand angelegter Programmpunkt
      // wird zum Punkt, statt eine Zahl zu tragen, die als POI-Nummer zu lesen
      // waere.
      const ohneNummer = poiNummer === null;
      el.className = ohneNummer
        ? `${styles.marker} ${styles.markerOhneNummer}`
        : styles.marker;
      el.textContent = ohneNummer ? "" : String(poiNummer);
      el.setAttribute("role", "img");
      el.setAttribute(
        "aria-label",
        ohneNummer ? activity.title : `POI ${poiNummer} · ${activity.title}`,
      );
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

  /**
   * Die Richtungspfeile auf den Verbindungslinien (req-075). Sie haengen als
   * Marker an der Karte statt als Kartenebene darin: so behalten sie auf
   * jeder Zoomstufe dieselbe Groesse, und die Drehung besorgt das
   * Stylesheet.
   *
   * Der Ausschnitt wird hier nicht angefasst -- kein fitBounds, kein
   * setCenter: das Ein- und Ausschalten laesst Zoom und Mitte, wie sie sind
   * (bug-048).
   */
  function renderPfeile(map: MapLibreMap) {
    pfeilMarkersRef.current.forEach((marker) => marker.remove());
    pfeilMarkersRef.current = [];
    if (!pfeileAn) return;

    const { lines } = buildDayMap(activities, transfers, optionSelections, {
      verlaeufe,
      verbindeOhneTransfer: true,
      poiNummern,
    });

    routenPfeile(lines).forEach((pfeil) => {
      const el = document.createElement("div");
      el.className = styles.pfeil;
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", pfeilBeschriftung(pfeil));
      el.setAttribute("data-testid", "route-arrow");
      // Die Drehung steht als Merkmal am Element, damit sie ohne
      // Stylesheet-Auswertung pruefbar ist -- jsdom rechnet kein CSS.
      el.setAttribute("data-winkel", pfeil.winkel.toFixed(1));

      const spitze = document.createElement("span");
      spitze.className = styles.pfeilSpitze;
      // KEINE Drehung am Marker-Element selbst: dort steht die Verschiebung,
      // mit der die Kartenbibliothek ihn an seinen Ort setzt.
      spitze.style.transform = `rotate(${pfeil.winkel}deg)`;
      el.appendChild(spitze);

      pfeilMarkersRef.current.push(
        new Marker({ element: el })
          .setLngLat([pfeil.position.lng, pfeil.position.lat])
          .addTo(map),
      );
    });
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

  // Die POI-Nummern als ein Wert, der sich nur mit ihnen aendert (bug-055): der
  // Aufrufer baut die Zuordnung bei jedem Durchlauf neu, und stuende sie selbst
  // in den Abhaengigkeitslisten unten, rueckte die Karte jedes Mal ihren
  // Ausschnitt zurecht (bug-048).
  const poiNummernSignatur = Array.from(poiNummern)
    .map(([id, nummer]) => `${id}:${nummer}`)
    .join(",");

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
    if (!map || !sized) return;

    const applyRoute = () => renderRoute(map);

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
  }, [
    activities,
    transfers,
    optionSelections,
    mainPlace,
    sized,
    verlaeufe,
    poiNummernSignatur,
  ]);

  // Die Pfeile stehen bewusst in einem eigenen Lauf (req-075): der Schalter
  // darf die Linien nicht neu zeichnen und schon gar nicht den Ausschnitt
  // ruecken (bug-048). Marker brauchen -- anders als Quellen und Ebenen --
  // keinen geladenen Stil.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sized) return;
    renderPfeile(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pfeileAn,
    activities,
    transfers,
    optionSelections,
    sized,
    verlaeufe,
    poiNummernSignatur,
  ]);

  const day = days.find((d) => d.date === selectedDate);
  const dayTitle = day
    ? `${day.weekday} · ${formatDayChipDate(day.date)}`
    : selectedDate;
  const totals = dayTransferTotals(activities, transfers);
  const pfeileLabel = pfeileAn ? "Pfeile ausblenden" : "Pfeile einblenden";

  return (
    // Die Farbe der Wege steht in lib/map/routenfarbe.ts (bug-059); die
    // Pfeilspitzen im Stylesheet nehmen sie von hier -- so wie die Griffe des
    // Suchgebiets in poi-map.tsx.
    <div
      className={styles.column}
      style={{ "--route": ROUTEN_FARBE } as CSSProperties}
    >
      <div
        ref={containerRef}
        className={styles.map}
        data-testid="day-route-map"
      />
      <div className={styles.overlay}>
        <p className={styles.dayTitle}>{dayTitle}</p>
        <p className={styles.totals}>{formatDayTransferTotals(totals)}</p>
      </div>
      {/* Oben rechts, gegenueber dem Tages-Schild -- ein Bedienelement der
          Karte, das nichts verdeckt (req-075, Constraints). Symbol statt
          Text, wie die Kartenknoepfe des POI-Bereichs (bug-042); was er tut,
          sagt sein Tooltip und sein aria-label. */}
      <button
        type="button"
        className={
          pfeileAn
            ? `${styles.pfeilSchalter} ${styles.pfeilSchalterAktiv}`
            : styles.pfeilSchalter
        }
        aria-pressed={pfeileAn}
        title={pfeileLabel}
        aria-label={pfeileLabel}
        data-testid="day-route-arrows-toggle"
        onClick={() => setPfeileAn((an) => !an)}
      >
        <RoutenPfeilIcon />
      </button>
    </div>
  );
}
