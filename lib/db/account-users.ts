import type { Queryable } from "./queryable";

/**
 * Die Personen des Accounts, wie sie der Bereich "Nutzer" zeigt (req-038):
 * Name, E-Mail, Kennzeichnung, Beitritt und letzte Anmeldung.
 *
 * Die letzte Anmeldung wird aus der juengsten Sitzung und der juengsten
 * Passkey-Nutzung ermittelt -- beides sind Belege dafuer, dass die Person
 * tatsaechlich hereingekommen ist.
 */
export interface AccountUser {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  accountAdmin: boolean;
  /** Ob die Person ihren Zugang schon eingeloest hat (req-023). */
  loginEnabled: boolean;
  /** Wann sie angelegt wurde. */
  joinedAt: string;
  lastSignInAt: string | null;
}

interface UserRow extends Record<string, unknown> {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  is_account_admin: boolean;
  login_enabled: boolean;
  created_at: Date;
}

function newest(dates: (Date | null)[]): string | null {
  const times = dates
    .filter((date): date is Date => date !== null && date !== undefined)
    .map((date) => new Date(date).getTime());
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

export async function listAccountUsers(
  db: Queryable,
  accountId: string,
): Promise<AccountUser[]> {
  const { rows } = await db.query<UserRow>(
    `select p.id, p.name, p.nickname, p.email, p.is_account_admin,
            p.login_enabled, p.created_at
     from participant p
     where p.account_id = $1
     order by p.created_at asc, p.name asc`,
    [accountId],
  );

  // Zwei schmale Abfragen statt eines Unterselects je Zeile: der juengste
  // Zeitpunkt wird in der Anwendung gebildet, damit die Abfragen einfach
  // bleiben und nach dem Account gefiltert sind.
  const sessions = await db.query<{ participant_id: string; created_at: Date }>(
    `select s.participant_id, s.created_at
     from session s
     join participant p on p.id = s.participant_id
     where p.account_id = $1`,
    [accountId],
  );
  const credentials = await db.query<{
    participant_id: string;
    last_used_at: Date | null;
  }>(
    `select c.participant_id, c.last_used_at
     from credential c
     join participant p on p.id = c.participant_id
     where p.account_id = $1`,
    [accountId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    email: row.email,
    accountAdmin: row.is_account_admin,
    loginEnabled: row.login_enabled,
    joinedAt: new Date(row.created_at).toISOString(),
    lastSignInAt: newest([
      ...sessions.rows
        .filter((session) => session.participant_id === row.id)
        .map((session) => session.created_at),
      ...credentials.rows
        .filter((credential) => credential.participant_id === row.id)
        .map((credential) => credential.last_used_at),
    ]),
  }));
}

/**
 * Eine offene Einladung (req-038): eine, die weder eingeloest noch
 * abgelaufen ist. Zurueckziehen entwertet sie serverseitig sofort.
 */
export interface OpenInvitation {
  participantId: string;
  name: string;
  email: string | null;
  expiresAt: string;
}

export async function listOpenInvitations(
  db: Queryable,
  accountId: string,
  now: Date,
): Promise<OpenInvitation[]> {
  const { rows } = await db.query<{
    participant_id: string;
    name: string;
    email: string | null;
    expires_at: Date;
  }>(
    `select l.participant_id, p.name, p.email, l.expires_at
     from access_link l
     join participant p on p.id = l.participant_id
     where p.account_id = $1 and l.used_at is null and l.expires_at > $2
     order by l.expires_at asc`,
    [accountId, now],
  );

  return rows.map((row) => ({
    participantId: row.participant_id,
    name: row.name,
    email: row.email,
    expiresAt: new Date(row.expires_at).toISOString(),
  }));
}
