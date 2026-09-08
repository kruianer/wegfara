import type { Queryable } from "./queryable";
import { tripBelongsToAccount } from "./trips";
import { deleteTripPosition } from "./trip-positions";

/**
 * Ob ein Teilnehmer seine Position bei dieser Reise teilt (req-050). Der
 * Schalter "Meine Position teilen" gilt bis zum Widerruf -- unabhaengig
 * davon, ob gerade tatsaechlich gesendet wird (siehe
 * migrations/0040_position_sharing.sql).
 */
export async function isPositionSharingEnabled(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select 1 from position_sharing
     where account_id = $1 and trip_id = $2 and participant_id = $3`,
    [accountId, tripId, participantId],
  );
  return rows.length > 0;
}

/**
 * Schaltet die Freigabe ein oder aus. Beim Ausschalten verschwindet auch
 * die zuletzt geteilte Position sofort -- sie soll nicht als letzter Stand
 * stehen bleiben (req-050).
 *
 * Liefert false, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function setPositionSharing(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
  enabled: boolean,
  now: Date,
): Promise<boolean> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return false;

  if (enabled) {
    await db.query(
      `insert into position_sharing (trip_id, participant_id, account_id, enabled_at)
       values ($1, $2, $3, $4)
       on conflict (trip_id, participant_id) do nothing`,
      [tripId, participantId, accountId, now],
    );
  } else {
    await db.query(
      `delete from position_sharing
       where trip_id = $1 and participant_id = $2 and account_id = $3`,
      [tripId, participantId, accountId],
    );
    await deleteTripPosition(db, accountId, tripId, participantId);
  }
  return true;
}

/**
 * Die Reisen dieses Accounts, fuer die die Person die Freigabe eingeschaltet
 * hat -- zum Vorbelegen des Schalters beim Aufbau der Seite, ohne je Reise
 * eine eigene Abfrage zu brauchen.
 */
export async function listEnabledTripIds(
  db: Queryable,
  accountId: string,
  participantId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ trip_id: string }>(
    `select trip_id from position_sharing
     where account_id = $1 and participant_id = $2`,
    [accountId, participantId],
  );
  return rows.map((row) => row.trip_id);
}
