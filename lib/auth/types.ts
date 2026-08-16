/** Das Konto einer Person innerhalb eines Accounts (siehe req-016). */
export interface Participant {
  id: string;
  accountId: string;
  name: string;
  email: string;
}

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
