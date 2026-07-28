import type { Queryable } from "./queryable";
import type { Activity, ActivityType } from "../activities/types";
import { toIsoDateTimeString } from "./sql-datetime";

interface ActivityRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  type: ActivityType;
  title: string;
  short_text: string;
  long_text: string;
  start_at: unknown;
  end_at: unknown;
  lat: number;
  lng: number;
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    tripId: row.trip_id,
    type: row.type,
    title: row.title,
    shortText: row.short_text,
    longText: row.long_text,
    startAt: toIsoDateTimeString(row.start_at),
    endAt: toIsoDateTimeString(row.end_at),
    position: { lat: row.lat, lng: row.lng },
  };
}

/** Alle Programmpunkte aller Reisen des Accounts (Mandantentrennung ueber trip). */
export async function listActivities(
  db: Queryable,
  accountId: string,
): Promise<Activity[]> {
  const { rows } = await db.query<ActivityRow>(
    `select a.id, a.trip_id, a.type, a.title, a.short_text, a.long_text,
            a.start_at, a.end_at, a.lat, a.lng
     from activity a
     join trip t on t.id = a.trip_id
     where t.account_id = $1
     order by a.start_at asc, a.id asc`,
    [accountId],
  );
  return rows.map(toActivity);
}
