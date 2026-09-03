/**
 * Eine Person innerhalb eines Accounts (siehe Glossar in
 * delivery/stack.md). Sie ist noch keiner einzelnen Reise zugeordnet --
 * eine solche Zuordnung gibt es im Datenmodell noch nicht (req-019).
 */
export interface Participant {
  id: string;
  accountId: string;
  name: string;
  /** null, solange keine Adresse hinterlegt ist (req-019). */
  email: string | null;
  /** null, solange keine Telefonnummer hinterlegt ist (req-019). */
  phone: string | null;
  /** Bankverbindung als IBAN ohne Leerzeichen; null, wenn keine (req-019). */
  iban: string | null;
  /**
   * Ob sich diese Person anmelden darf. Erfasste Personen erhalten keinen
   * Zugang zur Anwendung (req-019) -- Zugang hat heute allein der
   * Betreiber.
   */
  loginEnabled: boolean;
}
