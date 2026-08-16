import type { Queryable } from "./queryable";
import type { Participant } from "../auth/types";
import { normalizeEmail } from "../auth/tokens";

interface ParticipantRow extends Record<string, unknown> {
  id: string;
  account_id: string;
  name: string;
  email: string;
}

function toParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    email: row.email,
  };
}

/**
 * Sucht das Konto zu einer E-Mail-Adresse. Ohne Mandantenfilter, weil die
 * Anmeldung den Mandanten erst aus dem gefundenen Konto erfaehrt -- die
 * Adresse ist installationsweit eindeutig (siehe migrations/0015_auth.sql).
 */
export async function findParticipantByEmail(
  db: Queryable,
  email: string,
): Promise<Participant | null> {
  const { rows } = await db.query<ParticipantRow>(
    `select id, account_id, name, email from participant where email = $1`,
    [normalizeEmail(email)],
  );
  return rows[0] ? toParticipant(rows[0]) : null;
}

export async function findParticipantById(
  db: Queryable,
  id: string,
): Promise<Participant | null> {
  const { rows } = await db.query<ParticipantRow>(
    `select id, account_id, name, email from participant where id = $1`,
    [id],
  );
  return rows[0] ? toParticipant(rows[0]) : null;
}
