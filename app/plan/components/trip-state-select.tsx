"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import {
  TRIP_STATES,
  TRIP_STATE_ERRORS,
  TRIP_STATE_LABEL,
  isTripState,
  type TripState,
} from "@/lib/trips/state";
import { saveTripState } from "@/lib/trips/save-trip-state";
import styles from "./plan-cards.module.css";

/**
 * Der Zustand der geoeffneten Reise (req-022). Er wird gesetzt, nicht
 * berechnet -- der Zeitstatus entsteht dagegen aus dem Zeitraum und ist
 * deshalb anders dargestellt.
 *
 * Seit req-033 steht er in den Reisedetails, in der Karte "Eckdaten der
 * Reise". Im Aufklappmenue am Reisenamen ist er weiterhin zu sehen, dort
 * aber nicht mehr aenderbar.
 *
 * Gewechselt wird jederzeit in beide Richtungen: eine Freigabe laesst sich
 * zuruecknehmen, eine abgeschlossene Reise wieder oeffnen. Gespeichert wird
 * sofort beim Umstellen, nicht erst mit den Eckdaten.
 */
export function TripStateSelect({
  trip,
  onChanged,
}: {
  trip: Trip;
  /** Erst nach dem Speichern -- ein gescheiterter Wechsel aendert nichts. */
  onChanged: (state: TripState) => void;
}) {
  const [failed, setFailed] = useState(false);

  async function change(value: string) {
    if (!isTripState(value) || value === trip.state) return;
    setFailed(false);
    if (!(await saveTripState(trip.id, value))) {
      setFailed(true);
      return;
    }
    onChanged(value);
  }

  return (
    <>
      <select
        className={styles.stateSelect}
        aria-label={`Zustand: ${trip.title}`}
        value={trip.state}
        onChange={(event) => change(event.target.value)}
      >
        {TRIP_STATES.map((state) => (
          <option key={state} value={state}>
            {TRIP_STATE_LABEL[state]}
          </option>
        ))}
      </select>
      {failed && (
        <p className={styles.stateNotice} role="status">
          {TRIP_STATE_ERRORS.failed}
        </p>
      )}
    </>
  );
}
