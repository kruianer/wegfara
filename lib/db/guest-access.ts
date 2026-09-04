import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import { createToken, hashSecret } from "../auth/tokens";
import { guestAccessStatus } from "../guests/status";
import type { GuestAccess, GuestSession } from "../guests/types";

/**
 * Der Gastzugang (req-038) und die daran haengende Gast-Sitzung.
 *
 * Zwei Regeln gelten hier ausnahmslos: gespeichert wird ausschliesslich die
 * Pruefsumme des Tokens, und jede Abfrage filtert nach dem Account. Ein
 * Gastzugang eines fremden Accounts existiert fuer eine Sitzung nicht --
 * auch dann nicht, wenn seine Kennung bekannt ist.
 */

interface GuestAccessRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  trip_title: string;
  purpose: string;
  created_at: Date;
  expires_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

function toGuestAccess(row: GuestAccessRow, now: Date): GuestAccess {
  return {
    id: row.id,
    tripId: row.trip_id,
    tripTitle: row.trip_title,
    purpose: row.purpose,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    lastUsedAt: row.last_used_at
      ? new Date(row.last_used_at).toISOString()
      : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    status: guestAccessStatus(
      { expiresAt: row.expires_at, revokedAt: row.revoked_at },
      now,
    ),
  };
}

const GUEST_ACCESS_COLUMNS = `g.id, g.trip_id, t.title as trip_title, g.purpose,
       g.created_at, g.expires_at, g.last_used_at, g.revoked_at`;

export interface CreateGuestAccessInput {
  accountId: string;
  tripId: string;
  /** Der Reiseleiter, der ihn erstellt hat. */
  createdBy: string;
  purpose: string;
  /** Der Klartext des Links -- gespeichert wird nur seine Pruefsumme. */
  token: string;
  expiresAt: Date;
}

/**
 * Legt einen Gastzugang an. Die Reise muss zu diesem Account gehoeren --
 * geprueft wird das vom Aufrufer (siehe lib/guests/create-guest-access.ts).
 */
export async function createGuestAccess(
  db: Queryable,
  input: CreateGuestAccessInput,
  now: Date,
): Promise<GuestAccess | null> {
  const id = randomUUID();
  await db.query(
    `insert into guest_access
       (id, account_id, trip_id, created_by, purpose, token_hash,
        created_at, expires_at, last_used_at, revoked_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, null, null)`,
    [
      id,
      input.accountId,
      input.tripId,
      input.createdBy,
      input.purpose,
      hashSecret(input.token),
      now,
      input.expiresAt,
    ],
  );
  return findGuestAccess(db, input.accountId, id, now);
}

/** Ein Gastzugang dieses Accounts, sonst null. */
export async function findGuestAccess(
  db: Queryable,
  accountId: string,
  id: string,
  now: Date,
): Promise<GuestAccess | null> {
  const { rows } = await db.query<GuestAccessRow>(
    `select ${GUEST_ACCESS_COLUMNS}
     from guest_access g
     join trip t on t.id = g.trip_id
     where g.id = $1 and g.account_id = $2`,
    [id, accountId],
  );
  return rows[0] ? toGuestAccess(rows[0], now) : null;
}

/**
 * Die Gastzugaenge des Accounts, der neueste zuerst. Auf welche davon die
 * angemeldete Person schauen darf, entscheidet der Aufrufer (req-038): der
 * Reiseleiter sieht die seiner Reisen, ein Account-Admin alle.
 */
export async function listGuestAccesses(
  db: Queryable,
  accountId: string,
  now: Date,
): Promise<GuestAccess[]> {
  const { rows } = await db.query<GuestAccessRow>(
    `select ${GUEST_ACCESS_COLUMNS}
     from guest_access g
     join trip t on t.id = g.trip_id
     where g.account_id = $1
     order by g.created_at desc`,
    [accountId],
  );
  return rows.map((row) => toGuestAccess(row, now));
}

/**
 * Widerruft einen Gastzugang -- sofort und auch fuer eine bereits laufende
 * Gast-Sitzung (req-038): mit dem Widerruf verschwinden seine Sitzungen,
 * der naechste Aufruf des Gastes findet keine mehr.
 *
 * Ein Vorgang, bei dem der Nutzer eine Bestaetigung erwartet -- er wird
 * sofort geschrieben, nicht verzoegert (siehe delivery/stack.md).
 *
 * Liefert null, wenn der Zugang nicht zu diesem Account gehoert.
 */
export async function revokeGuestAccess(
  db: Queryable,
  accountId: string,
  id: string,
  now: Date,
): Promise<GuestAccess | null> {
  const existing = await findGuestAccess(db, accountId, id, now);
  if (!existing) return null;

  if (!existing.revokedAt) {
    await db.query(
      `update guest_access set revoked_at = $3
       where id = $1 and account_id = $2 and revoked_at is null`,
      [id, accountId, now],
    );
  }
  await deleteGuestSessionsOfAccess(db, id);
  return findGuestAccess(db, accountId, id, now);
}

/** Beendet alle Sitzungen eines Gastzugangs. */
export async function deleteGuestSessionsOfAccess(
  db: Queryable,
  guestAccessId: string,
): Promise<void> {
  await db.query(`delete from guest_session where guest_access_id = $1`, [
    guestAccessId,
  ]);
}

interface RedeemableRow extends Record<string, unknown> {
  id: string;
  account_id: string;
  trip_id: string;
  purpose: string;
  expires_at: Date;
}

/**
 * Loest einen Gastlink ein: er gilt, solange er weder widerrufen noch
 * abgelaufen ist. Anders als eine Einladung wird er dabei nicht verbraucht
 * -- ein Gast darf bis zum Ablauf wiederkommen; festgehalten wird nur seine
 * letzte Verwendung.
 *
 * Liefert die neue Gast-Sitzung, sonst null.
 */
export async function startGuestSession(
  db: Queryable,
  token: string,
  now: Date,
): Promise<{ session: GuestSession; token: string } | null> {
  if (!token) return null;

  const { rows } = await db.query<RedeemableRow>(
    `select id, account_id, trip_id, purpose, expires_at
     from guest_access
     where token_hash = $1 and revoked_at is null and expires_at > $2`,
    [hashSecret(token), now],
  );
  const access = rows[0];
  if (!access) return null;

  // Auch das Sitzungs-Token traegt 256 Bit Zufall und liegt nur als
  // Pruefsumme in der Datenbank -- wie bei den Teilnehmer-Sitzungen.
  const sessionToken = createToken();
  return {
    session: await insertGuestSession(db, access, sessionToken, now),
    token: sessionToken,
  };
}

async function insertGuestSession(
  db: Queryable,
  access: RedeemableRow,
  sessionToken: string,
  now: Date,
): Promise<GuestSession> {
  const id = randomUUID();
  // Die Sitzung endet nie spaeter als der Gastzugang (req-038): sie
  // uebernimmt dessen Ablauf und ist damit ausdruecklich von der
  // reisegebundenen Sitzungsdauer der Teilnehmer (req-023) ausgenommen.
  const expiresAt = new Date(access.expires_at);
  await db.query(
    `insert into guest_session (id, guest_access_id, token_hash, created_at, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [id, access.id, hashSecret(sessionToken), now, expiresAt],
  );
  await touchGuestAccess(db, access.id, now);
  return {
    id,
    guestAccessId: access.id,
    accountId: access.account_id,
    tripId: access.trip_id,
    purpose: access.purpose,
    expiresAt,
  };
}

interface GuestSessionRow extends Record<string, unknown> {
  id: string;
  guest_access_id: string;
  account_id: string;
  trip_id: string;
  purpose: string;
  expires_at: Date;
}

/**
 * Die Gast-Sitzung zum Token -- nur solange ihr Gastzugang weder
 * widerrufen noch abgelaufen ist (req-038). Beides wird hier bei jedem
 * Aufruf mitgeprueft und nicht nur beim Anlegen: ein Widerruf wirkt damit
 * sofort, auch mitten in einer laufenden Sitzung.
 */
export async function findGuestSessionByToken(
  db: Queryable,
  token: string,
  now: Date,
): Promise<GuestSession | null> {
  if (!token) return null;

  const { rows } = await db.query<GuestSessionRow>(
    `select s.id, s.guest_access_id, g.account_id, g.trip_id, g.purpose,
            s.expires_at
     from guest_session s
     join guest_access g on g.id = s.guest_access_id
     where s.token_hash = $1
       and s.expires_at > $2
       and g.expires_at > $2
       and g.revoked_at is null`,
    [hashSecret(token), now],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    guestAccessId: row.guest_access_id,
    accountId: row.account_id,
    tripId: row.trip_id,
    purpose: row.purpose,
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Haelt fest, wann der Gastzugang zuletzt benutzt wurde -- die Liste zeigt
 * es dem Reiseleiter (req-038). Geschrieben wird hoechstens einmal je
 * angefangener Viertelstunde: eine Anzeige "letzte Verwendung" braucht
 * keinen Schreibvorgang je Seitenaufruf.
 */
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export async function touchGuestAccess(
  db: Queryable,
  guestAccessId: string,
  now: Date,
): Promise<void> {
  const since = new Date(now.getTime() - TOUCH_INTERVAL_MS);
  await db.query(
    `update guest_access set last_used_at = $2
     where id = $1 and (last_used_at is null or last_used_at < $3)`,
    [guestAccessId, now, since],
  );
}

/** Beendet die Gast-Sitzung sofort -- der Gast meldet sich ab. */
export async function deleteGuestSessionByToken(
  db: Queryable,
  token: string,
): Promise<void> {
  if (!token) return;
  await db.query(`delete from guest_session where token_hash = $1`, [
    hashSecret(token),
  ]);
}

/** Raeumt abgelaufene Gast-Sitzungen weg; sie haben keinen Wert mehr. */
export async function deleteExpiredGuestSessions(
  db: Queryable,
  now: Date,
): Promise<void> {
  await db.query(`delete from guest_session where expires_at <= $1`, [now]);
}
