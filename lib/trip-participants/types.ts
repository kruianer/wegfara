/**
 * Die Zuordnung einer Person zu einer Reise (req-021). Wer bei welcher Reise
 * mitfaehrt, steht hier -- die Person selbst gehoert zum Account, nicht zu
 * einer Reise (siehe lib/participants/types.ts).
 */

/**
 * Genau zwei Rollen, fest vorgegeben (req-021, Constraints). Sie werden
 * nicht als Stammdaten gefuehrt: an einer Rolle haengen spaeter
 * Rechtepruefungen, die ohnehin im Code stehen.
 */
export const TRIP_ROLES = ["reiseleiter", "teilnehmer"] as const;

export type TripRole = (typeof TRIP_ROLES)[number];

/** Wie die Rollen in der Oberflaeche heissen. */
export const TRIP_ROLE_LABELS: Record<TripRole, string> = {
  reiseleiter: "Reiseleiter",
  teilnehmer: "Teilnehmer",
};

/** Die Rolle, die eine neu zugeordnete Person zunaechst traegt. */
export const DEFAULT_TRIP_ROLE: TripRole = "teilnehmer";

export interface TripParticipant {
  tripId: string;
  participantId: string;
  /**
   * Gilt nur fuer diese eine Reise -- dieselbe Person kann bei einer
   * anderen eine andere Rolle tragen (req-021).
   */
  role: TripRole;
}
