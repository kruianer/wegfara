import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import { hashSecret } from "../auth/tokens";
import { accessLinkExpiresAt } from "../auth/lifetime";

/**
 * Der Zugangslink einer Einladung (req-023). Gespeichert wird nur die
 * Pruefsumme des Tokens -- wer die Datenbank liest, kann sich damit nicht
 * anmelden (siehe Constraints in req-023).
 */
export async function createAccessLink(
  db: Queryable,
  participantId: string,
  token: string,
  now: Date,
): Promise<Date> {
  const expiresAt = accessLinkExpiresAt(now);
  await db.query(
    `insert into access_link (id, participant_id, token_hash, created_at, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [randomUUID(), participantId, hashSecret(token), now, expiresAt],
  );
  return expiresAt;
}

/**
 * Entwertet die bisherigen Zugangslinks einer Person. Wird eine neue
 * Einladung erzeugt, verliert die vorherige ihre Gueltigkeit (req-023) --
 * sonst blieben mehrere Wege in dasselbe Konto nebeneinander offen.
 */
export async function invalidateAccessLinks(
  db: Queryable,
  participantId: string,
  now: Date,
): Promise<void> {
  await db.query(
    `update access_link set used_at = $2 where participant_id = $1 and used_at is null`,
    [participantId, now],
  );
}

/**
 * Loest einen Zugangslink ein und entwertet ihn im selben Schritt. Die
 * Entwertung geschieht serverseitig in der Bedingung des UPDATE, nicht in
 * der Anzeige: ein zweiter Aufruf findet keine unbenutzte Zeile mehr und
 * liefert null -- auch dann, wenn beide Aufrufe gleichzeitig eintreffen
 * (req-023, Constraints).
 */
export async function consumeAccessLink(
  db: Queryable,
  token: string,
  now: Date,
): Promise<string | null> {
  if (!token) return null;
  const { rows } = await db.query<{ participant_id: string }>(
    `update access_link
     set used_at = $2
     where token_hash = $1 and used_at is null and expires_at > $2
     returning participant_id`,
    [hashSecret(token), now],
  );
  return rows[0]?.participant_id ?? null;
}
