import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import { hashSecret } from "../auth/tokens";
import { loginLinkExpiresAt } from "../auth/lifetime";

/**
 * Hinterlegt einen angeforderten Anmeldelink. Gespeichert wird nur die
 * Pruefsumme des Tokens -- wer die Datenbank liest, kann sich damit nicht
 * anmelden (siehe Constraints in req-016).
 */
export async function createLoginLink(
  db: Queryable,
  participantId: string,
  token: string,
  now: Date,
): Promise<void> {
  await db.query(
    `insert into login_link (id, participant_id, token_hash, created_at, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [
      randomUUID(),
      participantId,
      hashSecret(token),
      now,
      loginLinkExpiresAt(now),
    ],
  );
}

/**
 * Loest einen Anmeldelink ein und entwertet ihn im selben Schritt. Die
 * Entwertung geschieht serverseitig in der Bedingung des UPDATE: ein
 * zweiter Aufruf findet keine unbenutzte Zeile mehr und liefert null --
 * auch dann, wenn beide Aufrufe gleichzeitig eintreffen.
 */
export async function consumeLoginLink(
  db: Queryable,
  token: string,
  now: Date,
): Promise<string | null> {
  const { rows } = await db.query<{ participant_id: string }>(
    `update login_link
     set used_at = $2
     where token_hash = $1 and used_at is null and expires_at > $2
     returning participant_id`,
    [hashSecret(token), now],
  );
  return rows[0]?.participant_id ?? null;
}

/**
 * Alte Anmeldelinks einer Person entwerten, sobald ein neuer angefordert
 * wird: es soll immer nur der zuletzt verschickte Link gelten.
 */
export async function invalidateLoginLinks(
  db: Queryable,
  participantId: string,
  now: Date,
): Promise<void> {
  await db.query(
    `update login_link set used_at = $2 where participant_id = $1 and used_at is null`,
    [participantId, now],
  );
}
