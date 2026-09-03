import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { AccessStatus, AccountOverview } from "../accounts/types";
import { normalizeEmail } from "../auth/email";

/**
 * Die Accounts -- der Mandant selbst (siehe Glossar in delivery/stack.md).
 *
 * Die Abfragen dieser Datei laufen als einzige ueber alle Mandanten hinweg.
 * Das ist die bewusste Ausnahme aus req-025: nur der Gesamt-Admin ruft sie
 * auf, und er sieht dabei nichts als Namen, Personenzahl und Zugangsstatus
 * -- Reisedaten bleiben ohne Wechsel unsichtbar. Jede Stelle, die sie
 * verwendet, prueft die Kennzeichnung vorher (siehe
 * lib/auth/super-admin.ts).
 */

interface AccountRow extends Record<string, unknown> {
  id: string;
  name: string;
}

interface PersonRow extends Record<string, unknown> {
  id: string;
  account_id: string;
  name: string;
  login_enabled: boolean;
}

/** Ob es den Account gibt -- geprueft, bevor in ihn gewechselt wird. */
export async function accountExists(
  db: Queryable,
  accountId: string,
): Promise<boolean> {
  const { rows } = await db.query(`select id from account where id = $1`, [
    accountId,
  ]);
  return rows.length > 0;
}

/**
 * Ob die Adresse installationsweit schon vergeben ist. Sie muss es sein:
 * die Anmeldung loest eine Adresse auf, bevor der Mandant bekannt ist
 * (siehe migrations/0015_auth.sql). Geprueft wird gegen Personen und
 * Accounts, weil beide Tabellen sie eindeutig fuehren.
 */
export async function emailTakenAnywhere(
  db: Queryable,
  email: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const { rows } = await db.query(
    `select id from participant where email = $1`,
    [normalized],
  );
  if (rows.length > 0) return true;

  const { rows: accounts } = await db.query(
    `select id from account where email = $1`,
    [normalized],
  );
  return accounts.length > 0;
}

/**
 * Legt einen Account an (req-025). Ein Account entsteht ausschliesslich
 * durch den Gesamt-Admin -- eine Selbstregistrierung gibt es nicht.
 *
 * Die Adresse ist die der ersten Person: ueber sie ist der Account
 * erreichbar, solange er nur diese eine hat.
 */
export async function createAccount(
  db: Queryable,
  name: string,
  email: string,
): Promise<{ id: string; name: string }> {
  const id = randomUUID();
  await db.query(`insert into account (id, name, email) values ($1, $2, $3)`, [
    id,
    name,
    normalizeEmail(email),
  ]);
  return { id, name };
}

/**
 * Alle Accounts mit ihrer Personenzahl und dem Zugangsstatus ihrer ersten
 * Person (req-025). "Erste Person" ist die aelteste des Accounts -- dieselbe
 * Reihenfolge wie in der Liste der Reiseteilnehmer (siehe
 * lib/db/participants.ts).
 */
export async function listAccountsOverview(
  db: Queryable,
  now: Date,
): Promise<AccountOverview[]> {
  const { rows: accounts } = await db.query<AccountRow>(
    `select id, name from account order by name asc`,
  );

  const { rows: persons } = await db.query<PersonRow>(
    `select id, account_id, name, login_enabled
     from participant
     order by created_at asc, name asc`,
  );

  // Offene Einladungen: erzeugt, noch nicht eingeloest und noch nicht
  // abgelaufen (req-023).
  const { rows: offen } = await db.query<{ participant_id: string }>(
    `select participant_id from access_link
     where used_at is null and expires_at > $1`,
    [now],
  );
  const eingeladen = new Set(offen.map((row) => row.participant_id));

  return accounts.map((account) => {
    const eigene = persons.filter((person) => person.account_id === account.id);
    const erste = eigene[0];
    return {
      id: account.id,
      name: account.name,
      personCount: eigene.length,
      firstPerson: erste
        ? {
            id: erste.id,
            name: erste.name,
            access: accessStatusOf(
              erste.login_enabled,
              eingeladen.has(erste.id),
            ),
          }
        : null,
    };
  });
}

function accessStatusOf(loginEnabled: boolean, invited: boolean): AccessStatus {
  if (loginEnabled) return "eingeloest";
  return invited ? "eingeladen" : "offen";
}

/**
 * Die erste Person eines Accounts -- fuer sie erzeugt der Gesamt-Admin den
 * Zugangslink (req-025). null, wenn der Account keine hat.
 */
export async function findFirstPersonOfAccount(
  db: Queryable,
  accountId: string,
): Promise<{ id: string; name: string } | null> {
  const { rows } = await db.query<PersonRow>(
    `select id, account_id, name, login_enabled
     from participant
     where account_id = $1
     order by created_at asc, name asc`,
    [accountId],
  );
  const erste = rows[0];
  return erste ? { id: erste.id, name: erste.name } : null;
}
