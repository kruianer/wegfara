import type { Queryable } from "./queryable";
import type { Credential } from "../auth/types";

interface CredentialRow extends Record<string, unknown> {
  id: string;
  participant_id: string;
  public_key: string;
  counter: string | number;
  transports: string;
  label: string;
  created_at: Date;
  last_used_at: Date | null;
}

function toCredential(row: CredentialRow): Credential {
  return {
    id: row.id,
    participantId: row.participant_id,
    publicKey: row.public_key,
    counter: Number(row.counter),
    transports: row.transports ? row.transports.split(",") : [],
    label: row.label,
    createdAt: new Date(row.created_at),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
  };
}

const COLUMNS = `id, participant_id, public_key, counter, transports, label, created_at, last_used_at`;

/** Alle Passkeys eines Kontos -- ein Konto kann mehrere Geraete haben. */
export async function listCredentials(
  db: Queryable,
  participantId: string,
): Promise<Credential[]> {
  const { rows } = await db.query<CredentialRow>(
    `select ${COLUMNS} from credential where participant_id = $1 order by created_at asc`,
    [participantId],
  );
  return rows.map(toCredential);
}

/**
 * Sucht den Passkey, mit dem sich gerade jemand anmeldet. Ohne
 * Mandantenfilter, weil der Browser bei der Anmeldung nur die
 * Credential-ID mitschickt; das Konto ergibt sich daraus.
 */
export async function findCredentialById(
  db: Queryable,
  id: string,
): Promise<Credential | null> {
  const { rows } = await db.query<CredentialRow>(
    `select ${COLUMNS} from credential where id = $1`,
    [id],
  );
  return rows[0] ? toCredential(rows[0]) : null;
}

export async function createCredential(
  db: Queryable,
  credential: {
    id: string;
    participantId: string;
    publicKey: string;
    counter: number;
    transports: string[];
    label: string;
  },
  now: Date,
): Promise<void> {
  await db.query(
    `insert into credential (id, participant_id, public_key, counter, transports, label, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      credential.id,
      credential.participantId,
      credential.publicKey,
      credential.counter,
      credential.transports.join(","),
      credential.label,
      now,
    ],
  );
}

/**
 * Schreibt den Zaehler des Passkeys fort. Er dient dem Erkennen geklonter
 * Geraete und muss deshalb nach jeder Anmeldung aktualisiert werden.
 */
export async function updateCredentialUsage(
  db: Queryable,
  id: string,
  counter: number,
  now: Date,
): Promise<void> {
  await db.query(
    `update credential set counter = $2, last_used_at = $3 where id = $1`,
    [id, counter, now],
  );
}
