// Das Konto, mit dem sich jemand anmeldet, ist die Person selbst (siehe
// req-016). Der Datensatz dazu liegt seit req-019 in lib/participants/.
import type { Participant } from "../participants/types";

export type { Participant };

/** Der fremde Account, in dem der Gesamt-Admin gerade arbeitet (req-025). */
export interface ActingAccount {
  id: string;
  name: string;
}

/** Eine bestehende Anmeldung samt der Person, zu der sie gehoert. */
export interface Session {
  id: string;
  participant: Participant;
  /**
   * In wessen Account gerade gearbeitet wird. Normalerweise der Account der
   * angemeldeten Person; hat der Gesamt-Admin in einen fremden gewechselt,
   * dessen (req-025). Jede Abfrage auf Nutzerdaten filtert danach -- er
   * sieht immer nur einen Account, nie mehrere gleichzeitig.
   */
  accountId: string;
  /**
   * Gesetzt, solange der Gesamt-Admin in einem fremden Account arbeitet --
   * darauf weist der Balken am oberen Rand hin (req-025). null im eigenen.
   */
  actingAccount: ActingAccount | null;
  /**
   * Ob die angemeldete Person der Gesamt-Admin ist (req-025). Die
   * Kennzeichnung wird ausschliesslich direkt in der Datenbank gesetzt --
   * die Anwendung liest sie und schreibt sie an keiner Stelle.
   */
  superAdmin: boolean;
  expiresAt: Date;
}

/** Ein hinterlegter Passkey eines Kontos. */
export interface Credential {
  id: string;
  participantId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}
