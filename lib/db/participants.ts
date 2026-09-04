import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { Participant } from "../participants/types";
import type { ParticipantInput } from "../participants/validate";
import { normalizeEmail } from "../auth/email";
import {
  canSetAccountAdmin,
  promoteAccountAdminWhereMissing,
} from "../participants/account-admin";
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
  is_account_admin: boolean;
}

const COLUMNS = `id, account_id, name, nickname, email, phone, iban, login_enabled, is_account_admin`;

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
    accountAdmin: row.is_account_admin,
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

/**
 * Ob die Installation ueberhaupt schon eine Person kennt (req-037). Bewusst
 * ohne Mandantenfilter -- gefragt ist der Zustand der ganzen Installation,
 * nicht der eines Accounts: solange die Antwort false lautet, steht die
 * Ersteinrichtung offen, danach nie wieder.
 */
export async function anyParticipantExists(db: Queryable): Promise<boolean> {
  const { rows } = await db.query(`select id from participant limit 1`);
  return rows.length > 0;
}

/**
 * Legt die erste Person einer frisch deployten Umgebung an (req-037) -- mit
 * Zugang und als Account-Admin, weil sie sonst niemanden haette, der ihr
 * einen gibt. Aufgerufen wird das ausschliesslich aus der Ersteinrichtung,
 * und die gibt es nur, solange `anyParticipantExists` false liefert.
 */
export async function createFirstParticipant(
  db: Queryable,
  accountId: string,
  participantId: string,
  name: string,
  email: string,
  now: Date,
): Promise<Participant> {
  await db.query(
    `insert into participant (id, account_id, name, nickname, email, phone, iban, login_enabled, is_account_admin, created_at)
     values ($1, $2, $3, null, $4, null, null, true, true, $5)`,
    [participantId, accountId, name, normalizeEmail(email), now],
  );
  return {
    id: participantId,
    accountId,
    name,
    nickname: null,
    email: normalizeEmail(email),
    phone: null,
    iban: null,
    loginEnabled: true,
    accountAdmin: true,
  };
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
 * Gibt einer Person Zugang zur Anwendung (req-023). Gesetzt wird das beim
 * Einloesen des Zugangslinks, nicht beim Erzeugen der Einladung: Zugang hat,
 * wer tatsaechlich hereingekommen ist -- so bleibt in der Liste erkennbar,
 * wer noch keinen hat.
 *
 * Eine E-Mail-Adresse ist dafuer nicht noetig; sie eroeffnet nur den
 * zusaetzlichen Weg ueber den Anmeldelink (siehe
 * migrations/0022_access_link.sql).
 */
export async function enableLogin(
  db: Queryable,
  participantId: string,
): Promise<void> {
  await db.query(`update participant set login_enabled = true where id = $1`, [
    participantId,
  ]);
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
 *
 * `accountAdmin` traegt nur die erste Person eines neuen Accounts (req-027,
 * siehe lib/accounts/create-account.ts): sonst haette ein frischer Account
 * niemanden, der seine Personen verwalten darf. Wer spaeter dazukommt, wird
 * von einem Account-Admin ernannt.
 */
export async function createParticipant(
  db: Queryable,
  accountId: string,
  input: ParticipantInput,
  now: Date,
  accountAdmin = false,
): Promise<Participant> {
  const id = randomUUID();
  await db.query(
    `insert into participant (id, account_id, name, nickname, email, phone, iban, login_enabled, is_account_admin, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, false, $8, $9)`,
    [
      id,
      accountId,
      input.name,
      input.nickname,
      input.email,
      input.phone,
      input.iban,
      accountAdmin,
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
    accountAdmin,
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
 * Warum eine Kennzeichnung nicht gesetzt werden konnte (req-027):
 * `unknown` -- die Person gehoert nicht zu diesem Account,
 * `lastAdmin` -- es waere der letzte Account-Admin gewesen.
 */
export type AccountAdminFailure = "unknown" | "lastAdmin";

export type AccountAdminResult =
  | { ok: true; participant: Participant }
  | { ok: false; reason: AccountAdminFailure };

/**
 * Ernennt eine Person zum Account-Admin oder entzieht ihr die Kennzeichnung
 * (req-027). Geprueft wird gegen den Stand in der Datenbank und mit
 * derselben Regel wie in der Karte (siehe
 * lib/participants/account-admin.ts): der letzte Account-Admin behaelt die
 * Kennzeichnung -- ein Account hat immer mindestens einen.
 */
export async function setAccountAdmin(
  db: Queryable,
  accountId: string,
  id: string,
  accountAdmin: boolean,
): Promise<AccountAdminResult> {
  const existing = await findParticipantInAccount(db, accountId, id);
  if (!existing) return { ok: false, reason: "unknown" };

  const eigene = await listParticipants(db, accountId);
  if (!canSetAccountAdmin(eigene, id, accountAdmin)) {
    return { ok: false, reason: "lastAdmin" };
  }

  await db.query(
    `update participant set is_account_admin = $3
     where id = $1 and account_id = $2`,
    [id, accountId, accountAdmin],
  );
  return { ok: true, participant: { ...existing, accountAdmin } };
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
  // War sie der letzte Account-Admin, rueckt ebenso jemand nach -- ein
  // Account hat immer mindestens einen (req-027).
  await promoteAccountAdminInAccount(db, accountId);
  return true;
}

/**
 * Stellt sicher, dass der Account einen Account-Admin hat (req-027) -- nach
 * derselben Regel wie in der Karte (siehe
 * lib/participants/account-admin.ts): fehlt er, wird die dienstaelteste
 * verbliebene Person ernannt.
 */
async function promoteAccountAdminInAccount(
  db: Queryable,
  accountId: string,
): Promise<void> {
  const eigene = await listParticipants(db, accountId);
  const nachher = promoteAccountAdminWhereMissing(eigene);
  const nachgerueckt = nachher.find(
    (person, index) => person.accountAdmin && !eigene[index].accountAdmin,
  );
  if (!nachgerueckt) return;

  await db.query(
    `update participant set is_account_admin = true
     where id = $1 and account_id = $2`,
    [nachgerueckt.id, accountId],
  );
}
