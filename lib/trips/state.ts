/**
 * Der Zustand einer Reise (req-022): was der Reiseleiter selbst setzt --
 * anders als der Zeitstatus in status.ts, der sich aus dem Zeitraum
 * errechnet. Beide bestehen nebeneinander und sagen Verschiedenes: der
 * Zeitraum sagt, wann das Programm stattfindet, der Zustand, ob noch
 * geplant, schon freigegeben oder alles erledigt ist.
 */

/**
 * Genau drei Zustaende, fest vorgegeben (req-022, Constraints), in der
 * Reihenfolge, in der sie zur Auswahl stehen.
 */
export const TRIP_STATES = [
  "in_planung",
  "freigegeben",
  "abgeschlossen",
] as const;

export type TripState = (typeof TRIP_STATES)[number];

/** Wie die Zustaende in der Oberflaeche heissen. */
export const TRIP_STATE_LABEL: Record<TripState, string> = {
  in_planung: "In Planung",
  freigegeben: "Freigegeben",
  abgeschlossen: "Abgeschlossen",
};

/** Der Zustand einer neu angelegten Reise (req-022). */
export const DEFAULT_TRIP_STATE: TripState = "in_planung";

/** Rueckmeldung, wenn der Zustand nicht gespeichert werden konnte. */
export const TRIP_STATE_ERRORS = {
  failed: "Der Zustand konnte nicht gespeichert werden.",
} as const;

/** Ob der Wert einer der drei Zustaende ist -- die Pruefung an der Grenze. */
export function isTripState(value: unknown): value is TripState {
  return typeof value === "string" && TRIP_STATES.includes(value as TripState);
}
