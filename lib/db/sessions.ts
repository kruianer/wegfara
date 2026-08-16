import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { Session } from "../auth/types";
import { hashSecret } from "../auth/tokens";
import { sessionExpiresAt } from "../auth/lifetime";

interface SessionRow extends Record<string, unknown> {
  id: string;
  expires_at: Date;
  participant_id: string;
  account_id: string;
  name: string;
  email: string;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    expiresAt: new Date(row.expires_at),
    participant: {
      id: row.participant_id,
      accountId: row.account_id,
      name: row.name,
      email: row.email,
    },
  };
}

/**
 * Legt eine Sitzung an und liefert das Token, das ins Cookie gehoert. Das
 * Token selbst wird nie gespeichert -- in der Datenbank steht nur seine
 * Pruefsumme (siehe Constraints in req-016).
 */
export async function createSession(
  db: Queryable,
  participantId: string,
  token: string,
  now: Date,
): Promise<Session> {
  const id = randomUUID();
  const expiresAt = sessionExpiresAt(now);
  await db.query(
    `insert into session (id, participant_id, token_hash, created_at, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [id, participantId, hashSecret(token), now, expiresAt],
  );
  const session = await findSessionByToken(db, token, now);
  if (!session) {
    throw new Error("Sitzung konnte nicht angelegt werden");
  }
  return session;
}

/** Liefert die Sitzung zum Token, sofern sie existiert und nicht abgelaufen ist. */
export async function findSessionByToken(
  db: Queryable,
  token: string,
  now: Date,
): Promise<Session | null> {
  const { rows } = await db.query<SessionRow>(
    `select s.id, s.expires_at, p.id as participant_id, p.account_id, p.name, p.email
     from session s
     join participant p on p.id = s.participant_id
     where s.token_hash = $1 and s.expires_at > $2`,
    [hashSecret(token), now],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Verlaengert eine Sitzung bei Nutzung (req-016). */
export async function renewSession(
  db: Queryable,
  sessionId: string,
  now: Date,
): Promise<Date> {
  const expiresAt = sessionExpiresAt(now);
  await db.query(`update session set expires_at = $2 where id = $1`, [
    sessionId,
    expiresAt,
  ]);
  return expiresAt;
}

/**
 * Beendet die Sitzung sofort -- Abmelden ist ein Vorgang, bei dem der
 * Nutzer eine Bestaetigung erwartet, und wird deshalb nicht verzoegert
 * geschrieben (siehe Conventions in delivery/stack.md).
 */
export async function deleteSessionByToken(
  db: Queryable,
  token: string,
): Promise<void> {
  await db.query(`delete from session where token_hash = $1`, [
    hashSecret(token),
  ]);
}

/** Raeumt abgelaufene Sitzungen weg; sie haben keinen Wert mehr. */
export async function deleteExpiredSessions(
  db: Queryable,
  now: Date,
): Promise<void> {
  await db.query(`delete from session where expires_at <= $1`, [now]);
}
