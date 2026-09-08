"use client";

import { useEffect, useRef, useState } from "react";
import { Marker, type MapLibreMap } from "maplibre-gl";
import type { BenanntePosition } from "@/lib/positions/lade-positionen";
import { ladePositionen } from "@/lib/positions/lade-positionen";
import { sendePosition } from "@/lib/positions/sende-position";
import { setzePositionTeilen } from "@/lib/positions/setze-teilen";
import { holeStandort } from "@/lib/positions/geolocation";
import { sichtbarePositionen } from "@/lib/positions/sichtbar";
import { positionsAlterText } from "@/lib/positions/alter";
import { positionColor } from "@/lib/positions/farbe";
import styles from "./positions-layer.module.css";

/** Wie oft die eigene Position gesendet wird, waehrend geteilt wird. */
export const POSITION_SENDE_INTERVALL_MS = 15_000;

/** Wie oft die Positionen der anderen neu geholt werden. */
const POSITION_LADE_INTERVALL_MS = 15_000;

/** Wie oft das Alter der angezeigten Positionen aktualisiert wird. */
const ALTER_TAKT_MS = 20_000;

const STANDORT_ABGELEHNT_HINWEIS =
  "Standortzugriff wurde abgelehnt -- in den Geräteeinstellungen erlauben, um die Position zu teilen.";

/**
 * Der Schalter "Meine Position teilen", die Anzeige der geteilten
 * Positionen der Gruppe und ihre Punkte auf der Karte (req-050).
 *
 * Gesendet und geholt wird nur, solange diese Komponente lebt -- sie
 * existiert nur, waehrend die Karte offen ist (siehe map-view.tsx). Kein
 * Hintergrund-Standort (siehe stack.md).
 */
export function PositionsLayer({
  map,
  tripId,
  berechtigt,
  initialGeteilt,
}: {
  map: MapLibreMap | null;
  tripId: string;
  /**
   * Ob die Reise gerade freigegeben und im Zeitraum ist (siehe
   * lib/live-status/sichtbar.ts) -- nur dann wird tatsaechlich etwas
   * gesendet, auch bei eingeschaltetem Schalter.
   */
  berechtigt: boolean;
  /** Der Zustand des Schalters beim Aufbau der Seite. */
  initialGeteilt: boolean;
}) {
  const [geteilt, setGeteilt] = useState(initialGeteilt);
  const [anzeigeEin, setAnzeigeEin] = useState(true);
  const [standortFehler, setStandortFehler] = useState<string | null>(null);
  const [positionen, setPositionen] = useState<BenanntePosition[]>([]);
  const [jetzt, setJetzt] = useState(() => new Date());
  const markersRef = useRef<Marker[]>([]);

  // Das Alter ("vor 2 Min") lebt von der Uhr, nicht vom naechsten Abruf --
  // sonst stuende eine laengst veraltete Position noch auf der Karte.
  useEffect(() => {
    const uhr = setInterval(() => setJetzt(new Date()), ALTER_TAKT_MS);
    return () => clearInterval(uhr);
  }, []);

  // Die Positionen der Gruppe holen, solange die Anzeige eingeblendet ist.
  // Ausgeblendet zeigt die Karte keine Punkte -- unabhaengig davon, ob man
  // selbst gerade teilt (der Marker-Effekt unten blendet sie dafuer aus,
  // ohne dass der geholte Bestand hier verworfen werden muss).
  useEffect(() => {
    if (!anzeigeEin) return;
    let cancelled = false;
    const controller = new AbortController();

    async function holen() {
      const geladen = await ladePositionen(tripId, controller.signal);
      if (!cancelled) setPositionen(geladen);
    }

    void holen();
    const takt = setInterval(() => void holen(), POSITION_LADE_INTERVALL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(takt);
    };
  }, [tripId, anzeigeEin]);

  // Die eigene Position senden -- nur solange der Schalter an, die Anzeige
  // eingeblendet ist und die Reise es zulaesst. Lehnt der Browser die
  // Standortfreigabe ab, schaltet sich der Schalter selbst aus und die App
  // versucht es nicht weiter.
  useEffect(() => {
    if (!geteilt || !anzeigeEin) return;
    let cancelled = false;

    async function versuchen() {
      const standort = await holeStandort();
      if (cancelled) return;

      if (!standort.ok) {
        if (standort.grund === "abgelehnt") {
          setStandortFehler(STANDORT_ABGELEHNT_HINWEIS);
          setGeteilt(false);
          void setzePositionTeilen(tripId, false);
        }
        return;
      }

      setStandortFehler(null);
      if (berechtigt) void sendePosition(tripId, standort.lat, standort.lng);
    }

    void versuchen();
    const takt = setInterval(
      () => void versuchen(),
      POSITION_SENDE_INTERVALL_MS,
    );
    return () => {
      cancelled = true;
      clearInterval(takt);
    };
  }, [geteilt, anzeigeEin, berechtigt, tripId]);

  // Die Punkte auf der Karte -- unabhaengig vom gewaehlten Reisetag, darum
  // in einer eigenen Marker-Liste statt der des Tagesplans.
  useEffect(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (!map) return;

    const sichtbar = anzeigeEin ? sichtbarePositionen(positionen, jetzt) : [];
    markersRef.current = sichtbar.map((position) => {
      const el = document.createElement("div");
      el.className = styles.positionMarker;
      const dot = document.createElement("span");
      dot.className = styles.dot;
      dot.style.background = positionColor(position.participantId);
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = styles.label;
      label.textContent = `${position.name} · ${positionsAlterText(position.recordedAt, jetzt)}`;
      el.append(dot, label);
      el.setAttribute(
        "aria-label",
        `${position.name}, ${positionsAlterText(position.recordedAt, jetzt)}`,
      );
      return new Marker({ element: el })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [map, positionen, jetzt, anzeigeEin]);

  function handleToggleGeteilt() {
    const next = !geteilt;
    setStandortFehler(null);
    setGeteilt(next);
    void setzePositionTeilen(tripId, next);
  }

  return (
    <div className={styles.bar}>
      <button
        type="button"
        role="switch"
        aria-checked={geteilt}
        className={`${styles.toggle} ${geteilt ? styles.toggleOn : ""}`}
        onClick={handleToggleGeteilt}
      >
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        <span className={styles.toggleText}>Meine Position teilen</span>
      </button>
      <button
        type="button"
        className={styles.eyeButton}
        aria-pressed={anzeigeEin}
        aria-label={
          anzeigeEin ? "Positionen ausblenden" : "Positionen einblenden"
        }
        onClick={() => setAnzeigeEin((wert) => !wert)}
      >
        {anzeigeEin ? <EyeIcon /> : <EyeOffIcon />}
      </button>
      {standortFehler && <p className={styles.hinweis}>{standortFehler}</p>}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A11 11 0 0 1 12 5c7 0 11 7 11 7a17.5 17.5 0 0 1-3.4 4.2M6.6 6.6C3.4 8.5 1 12 1 12s4 7 11 7a10.6 10.6 0 0 0 5.1-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
