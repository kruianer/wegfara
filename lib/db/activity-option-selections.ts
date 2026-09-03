import type { Queryable } from "./queryable";
import { toIsoDateTimeString } from "./sql-datetime";
import { tripBelongsToAccount } from "./trips";

interface SelectionRow extends Record<string, unknown> {
  trip_id: string;
  start_at: unknown;
  end_at: unknown;
  selected_activity_id: string;
}

/**
 * Alle gespeicherten Wahlen von Options-Gruppen des Accounts, als Map von
 * Gruppen-Schluessel (siehe lib/activities/groups.ts `groupKey`) auf die
 * gewaehlte Programmpunkt-ID.
 */
export async function listActivityOptionSelections(
  db: Queryable,
  accountId: string,
): Promise<Record<string, string>> {
  const { rows } = await db.query<SelectionRow>(
    `select s.trip_id, s.start_at, s.end_at, s.selected_activity_id
     from activity_option_selection s
     join trip t on t.id = s.trip_id
     where t.account_id = $1`,
    [accountId],
  );

  const selections: Record<string, string> = {};
  for (const row of rows) {
    const key = `${row.trip_id}|${toIsoDateTimeString(row.start_at)}|${toIsoDateTimeString(row.end_at)}`;
    selections[key] = row.selected_activity_id;
  }
  return selections;
}

/**
 * Speichert oder aktualisiert die Wahl fuer eine Options-Gruppe. Die Reise
 * kommt aus der Anfrage, der Account aus der Anmeldung — gehoert sie nicht
 * zu diesem Account, wird nichts geschrieben (req-024).
 */
export async function setActivityOptionSelection(
  db: Queryable,
  accountId: string,
  tripId: string,
  startAt: string,
  endAt: string,
  activityId: string,
): Promise<boolean> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return false;

  await db.query(
    `insert into activity_option_selection (trip_id, start_at, end_at, selected_activity_id)
     values ($1, $2, $3, $4)
     on conflict (trip_id, start_at, end_at)
     do update set selected_activity_id = excluded.selected_activity_id`,
    [tripId, startAt, endAt, activityId],
  );
  return true;
}
