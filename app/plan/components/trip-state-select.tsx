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
import styles from "./header.module.css";

/**
 * Der Zustand der geoeffneten Reise im Aufklappmenue am Reisenamen
 * (req-022). Er wird gesetzt, nicht berechnet -- der Zeitstatus daneben
 * entsteht dagegen aus dem Zeitraum und ist deshalb anders dargestellt.
 *
 * Gewechselt wird jederzeit in beide Richtungen: eine Freigabe laesst sich
 * zuruecknehmen, eine abgeschlossene Reise wieder oeffnen.
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
