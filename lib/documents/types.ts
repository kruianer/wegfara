/**
 * Ein abgelegtes Dokument einer Reise (req-034) -- Ticket,
 * Buchungsbestaetigung, Mietwagenvertrag. Die Datei liegt im
 * Bildverzeichnis, dieser Datensatz in der Datenbank; ausgeliefert wird sie
 * ausschliesslich ueber `/api/dokumente/<id>` an eine angemeldete Person
 * des Accounts (siehe delivery/security.md).
 *
 * Der Name der Datei in der Ablage kommt hier bewusst nicht vor: die
 * Oberflaeche braucht ihn nicht, und er hat im Browser nichts zu suchen.
 */
export interface TripDocument {
  id: string;
  tripId: string;
  /** Der angezeigte Name, z.B. "Flugticket.pdf". */
  name: string;
  contentType: string;
  sizeBytes: number;
  /** Seitenzahl einer PDF-Datei; bei Bildern null. */
  pageCount: number | null;
  /** Verknuepfung mit einem POI der Reise -- oder mit einem Transfer, nie mit beidem. */
  poiId: string | null;
  transferId: string | null;
  /** Wer es abgelegt hat; null, wenn die Person nicht mehr im Account ist. */
  uploadedById: string | null;
  /** Zeitpunkt der Ablage (ISO-8601). */
  createdAt: string;
}

/** Was an einem Dokument nachtraeglich geaendert wird (req-034): Name und Verknuepfung. */
export interface DocumentDraft {
  name: string;
  poiId: string | null;
  transferId: string | null;
}
