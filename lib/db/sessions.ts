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
  nickname: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  login_enabled: boolean;
  is_account_admin: boolean;
  is_super_admin: boolean;
  acting_account_id: string | null;
  acting_account_name: string | null;
}

function toSession(row: SessionRow): Session {
  // Der Wechsel in einen fremden Account bleibt dem Gesamt-Admin
  // vorbehalten (req-025). Die Kennzeichnung wird hier mitgelesen und nicht
  // nur beim Wechseln geprueft: wird sie in der Datenbank entzogen, endet
  // damit auch ein laufender Wechsel.
  const acting =
    row.is_super_admin && row.acting_account_id
      ? { id: row.acting_account_id, name: row.acting_account_name ?? "" }
      : null;

  return {
    id: row.id,
    expiresAt: new Date(row.expires_at),
    accountId: acting ? acting.id : row.account_id,
    actingAccount: acting,
    superAdmin: row.is_super_admin,
    // Der Gesamt-Admin gilt in jedem Account, in den er gewechselt ist, als
    // Account-Admin (req-027) -- er arbeitet dort mit denselben Rechten wie
    // dessen eigene Personen.
    accountAdmin: row.is_super_admin || row.is_account_admin,
    participant: {
      id: row.participant_id,
      accountId: row.account_id,
      name: row.name,
      nickname: row.nickname,
      email: row.email,
      phone: row.phone,
      iban: row.iban,
      loginEnabled: row.login_enabled,
      accountAdmin: row.is_account_admin,
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
    `select s.id, s.expires_at, p.id as participant_id, p.account_id, p.name,
            p.nickname, p.email, p.phone, p.iban, p.login_enabled,
            p.is_account_admin, p.is_super_admin, s.acting_account_id,
            a.name as acting_account_name
     from session s
     join participant p on p.id = s.participant_id
     left join account a on a.id = s.acting_account_id
     where s.token_hash = $1 and s.expires_at > $2`,
    [hashSecret(token), now],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/**
 * Setzt den Account, in dem der Gesamt-Admin gerade arbeitet (req-025).
 * null bringt ihn in seinen eigenen zurueck.
 *
 * Der Wert haengt an der Sitzung, nicht an der Person: das Abmelden beendet
 * den Wechsel damit in jedem Fall, und eine zweite Sitzung derselben Person
 * bleibt davon unberuehrt. Ein Vorgang, bei dem der Nutzer eine Bestaetigung
 * erwartet -- er wird sofort geschrieben, nicht verzoegert (siehe
 * delivery/stack.md, Conventions).
 */
export async function setActingAccount(
  db: Queryable,
  sessionId: string,
  accountId: string | null,
): Promise<void> {
  await db.query(`update session set acting_account_id = $2 where id = $1`, [
    sessionId,
    accountId,
  ]);
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

/**
 * Beendet eine Sitzung, deren Voraussetzungen weggefallen sind (req-023):
 * die Person ist keiner freigegebenen Reise mehr zugeordnet. Sie meldet
 * sich wieder an, sobald sie einer zugeordnet ist.
 */
export async function deleteSessionById(
  db: Queryable,
  sessionId: string,
): Promise<void> {
  await db.query(`delete from session where id = $1`, [sessionId]);
}

/** Raeumt abgelaufene Sitzungen weg; sie haben keinen Wert mehr. */
export async function deleteExpiredSessions(
  db: Queryable,
  now: Date,
): Promise<void> {
  await db.query(`delete from session where expires_at <= $1`, [now]);
}
