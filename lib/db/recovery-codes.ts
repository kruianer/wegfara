import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import { hashRecoveryCode } from "../auth/recovery-codes";

/**
 * Ersetzt den Satz Notfallcodes einer Person vollstaendig: ein neuer Satz
 * loest den alten ab (req-016). Gespeichert wird ausschliesslich die
 * Pruefsumme je Code.
 */
export async function replaceRecoveryCodes(
  db: Queryable,
  participantId: string,
  codes: string[],
  now: Date,
): Promise<void> {
  await db.query(`delete from recovery_code where participant_id = $1`, [
    participantId,
  ]);
  for (const code of codes) {
    await db.query(
      `insert into recovery_code (id, participant_id, code_hash, created_at)
       values ($1, $2, $3, $4)`,
      [randomUUID(), participantId, hashRecoveryCode(code), now],
    );
  }
}

/** Die Zahl der noch unverbrauchten Codes ist jederzeit einsehbar (req-016). */
export async function countUnusedRecoveryCodes(
  db: Queryable,
  participantId: string,
): Promise<number> {
  const { rows } = await db.query<{ count: string | number }>(
    `select count(*) as count from recovery_code
     where participant_id = $1 and used_at is null`,
    [participantId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** True, sobald ueberhaupt schon einmal ein Satz erzeugt wurde. */
export async function hasRecoveryCodes(
  db: Queryable,
  participantId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ count: string | number }>(
    `select count(*) as count from recovery_code where participant_id = $1`,
    [participantId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/**
 * Verbraucht einen Notfallcode. Die Entwertung geschieht serverseitig in
 * der Bedingung des UPDATE, damit derselbe Code kein zweites Mal
 * angenommen wird -- auch nicht bei gleichzeitigen Versuchen.
 */
export async function consumeRecoveryCode(
  db: Queryable,
  participantId: string,
  code: string,
  now: Date,
): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `update recovery_code
     set used_at = $3
     where participant_id = $1 and code_hash = $2 and used_at is null
     returning id`,
    [participantId, hashRecoveryCode(code), now],
  );
  return rows.length > 0;
}
