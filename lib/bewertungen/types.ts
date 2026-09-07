/**
 * Die Bewertungsrunde und die Stimme (req-054, siehe Glossar in
 * delivery/stack.md).
 *
 * Die Stimme beschreibt die Person, der Status des POI den Ort: aus den
 * Stimmen folgt nie ein Status. Sie sind Entscheidungshilfe fuer den
 * Reiseleiter, kein Automatismus.
 */

/**
 * Die fuenf Stimmen, aus denen ein Teilnehmer je POI genau eine waehlt. Die
 * Reihenfolge ist die der Anzeige: von der groessten Zustimmung zur
 * Abwesenheit.
 */
export const STIMM_WAHLEN = [
  "unbedingt",
  "waere_schoen",
  "wenn_zeit",
  "lieber_nicht",
  "ohne_mich",
] as const;

export type StimmWahl = (typeof STIMM_WAHLEN)[number];

export function istStimmWahl(value: unknown): value is StimmWahl {
  return (
    typeof value === "string" &&
    (STIMM_WAHLEN as readonly string[]).includes(value)
  );
}

/** Die Beschriftungen der Stimmen, genau wie im Requirement (req-054). */
export const STIMM_WAHL_LABEL: Record<StimmWahl, string> = {
  unbedingt: "Will ich unbedingt",
  waere_schoen: "Wäre schön",
  wenn_zeit: "Wenn wir Zeit haben",
  lieber_nicht: "Lieber nicht",
  ohne_mich: "Ohne mich",
};

/**
 * `laeuft` -- es lassen sich Stimmen abgeben und aendern.
 * `beendet` -- die Stimmen bleiben sichtbar, neue kommen nicht mehr dazu.
 */
export const RUNDEN_STATUS = ["laeuft", "beendet"] as const;

export type RundenStatus = (typeof RUNDEN_STATUS)[number];

/** Eine Bewertungsrunde ueber ausgewaehlte POIs genau einer Reise. */
export interface Bewertungsrunde {
  id: string;
  tripId: string;
  status: RundenStatus;
  /** Die POIs, ueber die abgestimmt wird -- beim Starten festgelegt. */
  poiIds: string[];
  /** ISO-Zeitpunkt des Starts. */
  startedAt: string;
  /** ISO-Zeitpunkt des Beendens; null, solange die Runde laeuft. */
  endedAt: string | null;
}

/** Die Stimme einer Person zu einem POI einer Runde. */
export interface Stimme {
  roundId: string;
  poiId: string;
  participantId: string;
  wahl: StimmWahl;
}
