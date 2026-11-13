import type { Queryable } from "./queryable";

/**
 * Der Zugang fuer mitdenka (req-104) und der Zaehler seiner Abfragen bei
 * Google. In der Datenbank steht vom Schluessel nur die Pruefsumme -- gebildet
 * und verglichen wird eine Ebene darueber (lib/werkzeuge/zugang.ts).
 *
 * Jede Abfrage filtert nach dem Account, bis auf die eine, die aus der
 * Pruefsumme erst den Account ermittelt: sie ist der Weg, auf dem der Account
 * bei der Schnittstelle ueberhaupt ankommt (wie bei den Sitzungen).
 */

interface ZugangRow extends Record<string, unknown> {
  account_id: string;
  created_at: Date;
  last_used_at: Date | null;
}

export interface MitdenkaZugangZeile {
  accountId: string;
  erzeugtAm: Date;
  zuletztBenutzt: Date | null;
}

function toZeile(row: ZugangRow): MitdenkaZugangZeile {
  return {
    accountId: row.account_id,
    erzeugtAm: new Date(row.created_at),
    zuletztBenutzt: row.last_used_at ? new Date(row.last_used_at) : null,
  };
}

/** Der Zugang des Accounts -- ohne den Schluessel; null, wenn es keinen gibt. */
export async function findMitdenkaZugang(
  db: Queryable,
  accountId: string,
): Promise<MitdenkaZugangZeile | null> {
  const { rows } = await db.query<ZugangRow>(
    `select account_id, created_at, last_used_at
     from mitdenka_zugang
     where account_id = $1`,
    [accountId],
  );
  return rows[0] ? toZeile(rows[0]) : null;
}

/** Zu welchem Account eine Pruefsumme gehoert; null, wenn zu keinem. */
export async function findMitdenkaZugangByHash(
  db: Queryable,
  tokenHash: string,
): Promise<MitdenkaZugangZeile | null> {
  const { rows } = await db.query<ZugangRow>(
    `select account_id, created_at, last_used_at
     from mitdenka_zugang
     where token_hash = $1`,
    [tokenHash],
  );
  return rows[0] ? toZeile(rows[0]) : null;
}

/**
 * Legt den Zugang an oder ersetzt den vorhandenen. Der alte Schluessel ist
 * damit sofort ungueltig -- seine Pruefsumme steht nirgends mehr.
 */
export async function saveMitdenkaZugang(
  db: Queryable,
  accountId: string,
  tokenHash: string,
  now: Date,
): Promise<void> {
  await db.query(`delete from mitdenka_zugang where account_id = $1`, [
    accountId,
  ]);
  await db.query(
    `insert into mitdenka_zugang (account_id, token_hash, created_at, last_used_at)
     values ($1, $2, $3, null)`,
    [accountId, tokenHash, now],
  );
}

/** Widerruft den Zugang; der Schluessel wird ab sofort abgewiesen. */
export async function deleteMitdenkaZugang(
  db: Queryable,
  accountId: string,
): Promise<void> {
  await db.query(`delete from mitdenka_zugang where account_id = $1`, [
    accountId,
  ]);
}

/** Haelt fest, wann der Schluessel zuletzt benutzt wurde. */
export async function touchMitdenkaZugang(
  db: Queryable,
  accountId: string,
  now: Date,
): Promise<void> {
  await db.query(
    `update mitdenka_zugang set last_used_at = $2 where account_id = $1`,
    [accountId, now],
  );
}

/** Wie viele Google-Abfragen der Account an diesem Tag ueber die Schnittstelle stellte. */
export async function googleAbfragenAm(
  db: Queryable,
  accountId: string,
  tag: string,
): Promise<number> {
  const { rows } = await db.query<{ anzahl: number }>(
    `select anzahl from werkzeug_google_abfrage
     where account_id = $1 and tag = $2`,
    [accountId, tag],
  );
  return rows[0] ? Number(rows[0].anzahl) : 0;
}

/** Zaehlt eine Google-Abfrage dieses Tages hinzu. */
export async function zaehleGoogleAbfrage(
  db: Queryable,
  accountId: string,
  tag: string,
): Promise<void> {
  await db.query(
    `insert into werkzeug_google_abfrage (account_id, tag, anzahl)
     values ($1, $2, 1)
     on conflict (account_id, tag)
     do update set anzahl = werkzeug_google_abfrage.anzahl + 1`,
    [accountId, tag],
  );
}
