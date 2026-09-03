import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { Participant } from "../participants/types";
import type { ParticipantInput } from "../participants/validate";
import { normalizeEmail } from "../auth/email";
import { promoteLeadersInAccount } from "./trip-participants";

interface ParticipantRow extends Record<string, unknown> {
  id: string;
  account_id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  login_enabled: boolean;
}

const COLUMNS = `id, account_id, name, nickname, email, phone, iban, login_enabled`;

function toParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    iban: row.iban,
    loginEnabled: row.login_enabled,
  };
}

/**
 * Sucht die Person, die sich mit dieser E-Mail-Adresse anmelden darf. Ohne
 * Mandantenfilter, weil die Anmeldung den Mandanten erst aus der gefundenen
 * Person erfaehrt -- die Adresse ist installationsweit eindeutig (siehe
 * migrations/0015_auth.sql).
 *
 * Erfasste Personen ohne Zugang bleiben hier unsichtbar: sie erhalten
 * keinen Anmeldelink (req-019).
 */
export async function findParticipantByEmail(
  db: Queryable,
  email: string,
): Promise<Participant | null> {
  const { rows } = await db.query<ParticipantRow>(
    `select ${COLUMNS} from participant where email = $1 and login_enabled`,
    [normalizeEmail(email)],
  );
  return rows[0] ? toParticipant(rows[0]) : null;
}

/** Die Person zu einer Id, sofern sie sich anmelden darf (req-019). */
export async function findParticipantById(
  db: Queryable,
  id: string,
): Promise<Participant | null> {
  const { rows } = await db.query<ParticipantRow>(
    `select ${COLUMNS} from participant where id = $1 and login_enabled`,
    [id],
  );
  return rows[0] ? toParticipant(rows[0]) : null;
}

/**
 * Alle Personen des Accounts, aelteste zuerst -- so bleibt die eigene
 * Person oben, und neu Angelegtes reiht sich hinten ein (req-019).
 */
export async function listParticipants(
  db: Queryable,
  accountId: string,
): Promise<Participant[]> {
  const { rows } = await db.query<ParticipantRow>(
    `select ${COLUMNS}
     from participant
     where account_id = $1
     order by created_at asc, name asc`,
    [accountId],
  );
  return rows.map(toParticipant);
}

/**
 * Ob die Adresse im Account schon zu einer anderen Person gehoert
 * (req-019). `exceptId` nimmt die gerade geaenderte Person aus, damit sie
 * ihre eigene Adresse behalten darf.
 */
export async function emailTakenInAccount(
  db: Queryable,
  accountId: string,
  email: string,
  exceptId: string | null = null,
): Promise<boolean> {
  const { rows } = exceptId
    ? await db.query(
        `select id from participant
         where account_id = $1 and email = $2 and id <> $3`,
        [accountId, normalizeEmail(email), exceptId],
      )
    : await db.query(
        `select id from participant where account_id = $1 and email = $2`,
        [accountId, normalizeEmail(email)],
      );
  return rows.length > 0;
}

/**
 * Legt eine Person im Account an (req-019). Sie erhaelt keinen Zugang zur
 * Anwendung -- das bleibt dem Betreiber vorbehalten.
 */
export async function createParticipant(
  db: Queryable,
  accountId: string,
  input: ParticipantInput,
  now: Date,
): Promise<Participant> {
  const id = randomUUID();
  await db.query(
    `insert into participant (id, account_id, name, nickname, email, phone, iban, login_enabled, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, false, $8)`,
    [
      id,
      accountId,
      input.name,
      input.nickname,
      input.email,
      input.phone,
      input.iban,
      now,
    ],
  );
  return {
    id,
    accountId,
    name: input.name,
    nickname: input.nickname,
    email: input.email,
    phone: input.phone,
    iban: input.iban,
    loginEnabled: false,
  };
}

/** Die Person des Accounts, gleich ob sie sich anmelden darf (req-019). */
export async function findParticipantInAccount(
  db: Queryable,
  accountId: string,
  id: string,
): Promise<Participant | null> {
  const { rows } = await db.query<ParticipantRow>(
    `select ${COLUMNS} from participant where id = $1 and account_id = $2`,
    [id, accountId],
  );
  return rows[0] ? toParticipant(rows[0]) : null;
}

/**
 * Aendert Name, Nickname (req-020) und Kontaktdaten einer Person
 * (req-019). Der Zugang bleibt
 * unberuehrt -- er wird hier nie vergeben und nie entzogen.
 *
 * Liefert null, wenn die Person nicht zu diesem Account gehoert.
 */
export async function updateParticipant(
  db: Queryable,
  accountId: string,
  id: string,
  input: ParticipantInput,
): Promise<Participant | null> {
  const existing = await findParticipantInAccount(db, accountId, id);
  if (!existing) return null;

  await db.query(
    `update participant
     set name = $3, nickname = $4, email = $5, phone = $6, iban = $7
     where id = $1 and account_id = $2`,
    [
      id,
      accountId,
      input.name,
      input.nickname,
      input.email,
      input.phone,
      input.iban,
    ],
  );
  return { ...existing, ...input };
}

/**
 * Entfernt eine Person samt allem, was an ihr haengt (req-019) -- auch aus
 * allen Reisen, denen sie zugeordnet war (req-021). Liefert false, wenn sie
 * nicht zu diesem Account gehoert.
 */
export async function deleteParticipant(
  db: Queryable,
  accountId: string,
  id: string,
): Promise<boolean> {
  if (!(await findParticipantInAccount(db, accountId, id))) return false;

  await db.query(`delete from participant where id = $1 and account_id = $2`, [
    id,
    accountId,
  ]);
  // War sie der letzte Reiseleiter einer Reise, rueckt jemand nach -- eine
  // Reise hat immer mindestens einen (req-021).
  await promoteLeadersInAccount(db, accountId);
  return true;
}
