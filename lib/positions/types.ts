/**
 * Die zuletzt geteilte Position eines Teilnehmers bei einer Reise. Es gibt
 * je Teilnehmer und Reise hoechstens eine -- jede neue ueberschreibt die
 * vorherige, es entsteht keine Historie (siehe delivery/vision.md,
 * Leitprinzipien).
 *
 * Dass ein Eintrag existiert, heisst: diese Person teilt ihre Position.
 * Wer nicht mehr teilt, hat keinen.
 */
export interface GeteiltePosition {
  tripId: string;
  participantId: string;
  lat: number;
  lng: number;
  /**
   * Die Ortschaft zur Position, sofern sie beim Speichern ermittelt wurde;
   * null heisst "noch nicht nachgeschlagen" (siehe lib/osm/ort-lookup.ts).
   */
  ort: string | null;
  /** Zeitpunkt der Messung, ISO mit Zeitzone. */
  recordedAt: string;
}
