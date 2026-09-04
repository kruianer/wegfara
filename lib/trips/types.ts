import type { TripState } from "./state";

export interface MainPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface Trip {
  id: string;
  title: string;
  /** ISO-Datum (YYYY-MM-DD), ohne Uhrzeit. */
  startDate: string;
  /** ISO-Datum (YYYY-MM-DD), ohne Uhrzeit. */
  endDate: string;
  mainPlace: MainPlace;
  /**
   * Der freiwillige Text fuer die Gruppe (req-033) -- was geplant ist, was
   * mitzubringen, worauf zu achten. Leer, solange nichts eingetragen ist;
   * "nicht gesetzt" gibt es nicht.
   */
  description: string;
  /**
   * Der gesetzte Zustand (req-022) -- unabhaengig vom Zeitraum. Der aus dem
   * Zeitraum berechnete Zeitstatus steht nicht hier, sondern entsteht bei
   * Bedarf aus start- und endDate (siehe lib/trips/status.ts).
   */
  state: TripState;
}
