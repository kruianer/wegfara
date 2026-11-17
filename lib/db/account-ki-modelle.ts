import type { Queryable } from "./queryable";
import {
  KEINE_WAHL,
  istKiZweck,
  type KiModellWahl,
  type KiZweck,
} from "../ki-modelle/zwecke";

/**
 * Die KI-Modelle, die ein Account gewaehlt hat (req-108). Der Modellname steht
 * im Klartext -- anders als bei den Zugangsschluesseln gibt es hier nichts zu
 * verbergen.
 *
 * Jede Abfrage filtert nach dem Account: die Wahl eines anderen Accounts
 * existiert fuer diese Sitzung nicht (stack.md, Mandantenfaehigkeit).
 */

interface AccountKiModellRow extends Record<string, unknown> {
  zweck: string;
  modell: string;
}

/** Die Wahl je Zweck; ein Zweck ohne Zeile ist nicht gewaehlt. */
export async function findAccountKiModelle(
  db: Queryable,
  accountId: string,
): Promise<KiModellWahl> {
  const { rows } = await db.query<AccountKiModellRow>(
    `select zweck, modell
     from account_ki_modell
     where account_id = $1`,
    [accountId],
  );
  const wahl: KiModellWahl = { ...KEINE_WAHL };
  for (const row of rows) {
    if (istKiZweck(row.zweck)) wahl[row.zweck] = row.modell;
  }
  return wahl;
}

/**
 * Setzt die Wahl fuer einen Zweck oder hebt sie auf (null). Der Nutzer
 * erwartet eine Bestaetigung -- sofort geschrieben, nicht verzoegert
 * (stack.md, Conventions).
 */
export async function saveAccountKiModell(
  db: Queryable,
  accountId: string,
  zweck: KiZweck,
  modell: string | null,
  now: Date,
): Promise<void> {
  if (modell === null) {
    await db.query(
      `delete from account_ki_modell where account_id = $1 and zweck = $2`,
      [accountId, zweck],
    );
    return;
  }
  await db.query(
    `insert into account_ki_modell (account_id, zweck, modell, updated_at)
     values ($1, $2, $3, $4)
     on conflict (account_id, zweck)
     do update set modell = excluded.modell,
                   updated_at = excluded.updated_at`,
    [accountId, zweck, modell, now],
  );
}
