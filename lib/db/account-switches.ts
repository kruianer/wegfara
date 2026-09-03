import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";

/**
 * Das Protokoll der Account-Wechsel (req-025): wer, in welchen Account,
 * wann. Es wird geschrieben, aber nicht in der Oberflaeche gezeigt -- die
 * Ansicht ist ausdruecklich nicht Teil des Requirements.
 */
export interface AccountSwitchEntry {
  /** Wer gewechselt hat -- der Name der Person, nicht nur ihre Kennung. */
  participantName: string;
  /** In welchen Account -- dessen Name. */
  accountName: string;
  accountId: string;
  /** Wann. */
  switchedAt: Date;
}

/**
 * Haelt einen Wechsel in einen fremden Account fest. Er wird sofort
 * geschrieben, nicht verzoegert: ein Protokolleintrag, der beim Verlassen
 * der Seite verlorengeht, waere keiner (siehe delivery/stack.md,
 * Conventions).
 */
export async function recordAccountSwitch(
  db: Queryable,
  participantId: string,
  accountId: string,
  now: Date,
): Promise<void> {
  await db.query(
    `insert into account_switch (id, participant_id, account_id, switched_at)
     values ($1, $2, $3, $4)`,
    [randomUUID(), participantId, accountId, now],
  );
}

/** Die festgehaltenen Wechsel, neueste zuerst. */
export async function listAccountSwitches(
  db: Queryable,
): Promise<AccountSwitchEntry[]> {
  const { rows } = await db.query<{
    participant_name: string;
    account_name: string;
    account_id: string;
    switched_at: Date;
  }>(
    `select p.name as participant_name, a.name as account_name,
            s.account_id, s.switched_at
     from account_switch s
     join participant p on p.id = s.participant_id
     join account a on a.id = s.account_id
     order by s.switched_at desc`,
  );
  return rows.map((row) => ({
    participantName: row.participant_name,
    accountName: row.account_name,
    accountId: row.account_id,
    switchedAt: new Date(row.switched_at),
  }));
}
