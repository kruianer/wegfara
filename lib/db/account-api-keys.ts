import type { Queryable } from "./queryable";
import type { ApiKeyKind, ApiKeyState } from "../api-keys/types";

/**
 * Die hinterlegten Zugangsschluessel eines Accounts (req-028). In der
 * Datenbank steht ausschliesslich der verschluesselte Wert -- diese Schicht
 * reicht ihn durch, ohne ihn zu deuten; ver- und entschluesselt wird eine
 * Ebene darueber (siehe lib/api-keys/account-keys.ts).
 *
 * Jede Abfrage filtert nach dem Account: der Schluessel eines fremden
 * Accounts existiert fuer diese Sitzung nicht (siehe delivery/stack.md,
 * Mandantenfaehigkeit).
 */

interface AccountApiKeyRow extends Record<string, unknown> {
  kind: string;
  ciphertext: string;
  last_four: string;
}

/**
 * Der Zustand der hinterlegten Schluessel -- ohne den Schluessel selbst.
 * Genau das, was die Karte "Zugangsschluessel" zeigen darf.
 */
export async function listAccountApiKeys(
  db: Queryable,
  accountId: string,
): Promise<ApiKeyState[]> {
  const { rows } = await db.query<AccountApiKeyRow>(
    `select kind, ciphertext, last_four
     from account_api_key
     where account_id = $1`,
    [accountId],
  );
  return rows.map((row) => ({
    kind: row.kind as ApiKeyKind,
    lastFour: row.last_four,
  }));
}

/**
 * Der verschluesselte Schluessel dieser Art. Er verlaesst den Server nie --
 * gebraucht wird er ausschliesslich, um bei OpenAI oder Google anzufragen.
 */
export async function findAccountApiKeyCiphertext(
  db: Queryable,
  accountId: string,
  kind: ApiKeyKind,
): Promise<string | null> {
  const { rows } = await db.query<AccountApiKeyRow>(
    `select kind, ciphertext, last_four
     from account_api_key
     where account_id = $1 and kind = $2`,
    [accountId, kind],
  );
  return rows[0]?.ciphertext ?? null;
}

/**
 * Hinterlegt einen Schluessel oder ersetzt den vorhandenen. Ein Vorgang, bei
 * dem der Nutzer eine Bestaetigung erwartet -- er wird sofort geschrieben,
 * nicht verzoegert (siehe delivery/stack.md, Conventions).
 */
export async function saveAccountApiKey(
  db: Queryable,
  accountId: string,
  kind: ApiKeyKind,
  ciphertext: string,
  lastFour: string,
  now: Date,
): Promise<void> {
  await db.query(
    `insert into account_api_key (account_id, kind, ciphertext, last_four, updated_at)
     values ($1, $2, $3, $4, $5)
     on conflict (account_id, kind)
     do update set ciphertext = excluded.ciphertext,
                   last_four = excluded.last_four,
                   updated_at = excluded.updated_at`,
    [accountId, kind, ciphertext, lastFour, now],
  );
}

/**
 * Entfernt einen Schluessel. Danach ist die zugehoerige Funktion fuer diesen
 * Account gesperrt (req-028) -- auf einen anderen Schluessel wird nicht
 * zurueckgegriffen.
 */
export async function deleteAccountApiKey(
  db: Queryable,
  accountId: string,
  kind: ApiKeyKind,
): Promise<void> {
  await db.query(
    `delete from account_api_key where account_id = $1 and kind = $2`,
    [accountId, kind],
  );
}
