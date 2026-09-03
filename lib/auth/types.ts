// Das Konto, mit dem sich jemand anmeldet, ist die Person selbst (siehe
// req-016). Der Datensatz dazu liegt seit req-019 in lib/participants/.
import type { Participant } from "../participants/types";

export type { Participant };

/** Eine bestehende Anmeldung samt der Person, zu der sie gehoert. */
export interface Session {
  id: string;
  participant: Participant;
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
