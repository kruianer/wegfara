import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type {
  Activity,
  ActivityType,
  ActivityValues,
} from "../activities/types";
import { tripBelongsToAccount } from "./trips";
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
  lat: number | null;
  lng: number | null;
  booked: boolean;
  booking_url: string | null;
  booking_email: string | null;
  booking_phone: string | null;
  poi_id: string | null;
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
    position:
      row.lat != null && row.lng != null
        ? { lat: row.lat, lng: row.lng }
        : undefined,
    booked: row.booked,
    bookingUrl: row.booking_url ?? undefined,
    bookingEmail: row.booking_email ?? undefined,
    bookingPhone: row.booking_phone ?? undefined,
    poiId: row.poi_id ?? undefined,
  };
}

const ACTIVITY_COLUMNS = `id, trip_id, type, title, short_text, long_text,
                          start_at, end_at, lat, lng,
                          booked, booking_url, booking_email, booking_phone, poi_id`;

/** Dieselben Spalten, qualifiziert fuer die Abfragen mit Verknuepfung. */
const ACTIVITY_COLUMNS_JOINED = `a.id, a.trip_id, a.type, a.title, a.short_text, a.long_text,
                                 a.start_at, a.end_at, a.lat, a.lng,
                                 a.booked, a.booking_url, a.booking_email, a.booking_phone, a.poi_id`;

/**
 * Die Uhrzeit gilt als Ortszeit am Reiseziel und wird nicht umgerechnet
 * (siehe bug-004) -- geschrieben wird sie deshalb als schlichter Text ohne
 * Zeitzone, so wie sie in der Anwendung steht.
 */
function toSqlDateTime(value: string): string {
  return value.replace("T", " ");
}

/** Alle Programmpunkte aller Reisen des Accounts (Mandantentrennung ueber trip). */
export async function listActivities(
  db: Queryable,
  accountId: string,
): Promise<Activity[]> {
  const { rows } = await db.query<ActivityRow>(
    `select ${ACTIVITY_COLUMNS_JOINED}
     from activity a
     join trip t on t.id = a.trip_id
     where t.account_id = $1
     order by a.start_at asc, a.id asc`,
    [accountId],
  );
  return rows.map(toActivity);
}

/**
 * Legt einen Programmpunkt an -- beim Verplanen eines POI (req-039). Er
 * gehoert zu dem Reisetag, an dem er beginnt; dass dieser im Zeitraum der
 * Reise liegt, prueft die Domaenenlogik vorher (siehe lib/plan/plan-poi.ts).
 *
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert (req-024).
 */
export async function createActivity(
  db: Queryable,
  accountId: string,
  values: ActivityValues,
): Promise<Activity | null> {
  if (!(await tripBelongsToAccount(db, accountId, values.tripId))) return null;

  const { rows } = await db.query<ActivityRow>(
    `insert into activity (id, trip_id, poi_id, type, title, short_text, long_text,
                           start_at, end_at, lat, lng)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning ${ACTIVITY_COLUMNS}`,
    [
      randomUUID(),
      values.tripId,
      values.poiId,
      values.type,
      values.title,
      values.shortText,
      values.longText,
      toSqlDateTime(values.startAt),
      toSqlDateTime(values.endAt),
      values.position?.lat ?? null,
      values.position?.lng ?? null,
    ],
  );
  return toActivity(rows[0]);
}

/** Der Programmpunkt, aber nur wenn er zu einer Reise dieses Accounts gehoert. */
async function activityRow(
  db: Queryable,
  accountId: string,
  activityId: string,
): Promise<ActivityRow | null> {
  const { rows } = await db.query<ActivityRow>(
    `select ${ACTIVITY_COLUMNS_JOINED}
     from activity a
     join trip t on t.id = a.trip_id
     where a.id = $1 and t.account_id = $2`,
    [activityId, accountId],
  );
  return rows[0] ?? null;
}

/** Ein einzelner Programmpunkt des Accounts; null, wenn es ihn dort nicht gibt. */
export async function findActivity(
  db: Queryable,
  accountId: string,
  activityId: string,
): Promise<Activity | null> {
  const row = await activityRow(db, accountId, activityId);
  return row ? toActivity(row) : null;
}

/**
 * Verschiebt einen Programmpunkt oder aendert seine Dauer (req-040) -- beides
 * betrifft nur seine Zeiten. Dass sie einrasten, im Reisezeitraum liegen und
 * die kuerzeste Dauer wahren, rechnet die Domaenenlogik vorher aus (siehe
 * lib/plan/move-activity.ts).
 *
 * Der Reisetag ergibt sich wie beim Anlegen aus dem Beginn; eine eigene
 * Spalte dafuer gibt es nicht. Liefert null, wenn es im Account keinen
 * solchen Programmpunkt gibt (req-024).
 */
export async function updateActivityTimes(
  db: Queryable,
  accountId: string,
  activityId: string,
  times: { startAt: string; endAt: string },
): Promise<Activity | null> {
  if (!(await activityRow(db, accountId, activityId))) return null;

  const { rows } = await db.query<ActivityRow>(
    `update activity set start_at = $2, end_at = $3
     where id = $1
     returning ${ACTIVITY_COLUMNS}`,
    [activityId, toSqlDateTime(times.startAt), toSqlDateTime(times.endAt)],
  );
  return rows[0] ? toActivity(rows[0]) : null;
}

/**
 * Entfernt einen Programmpunkt (req-039). Stammt er aus einem POI, steht
 * dieser danach wieder unter "Noch unverplant" -- dafuer liefert die
 * Funktion den entfernten Programmpunkt samt seiner Verknuepfung zurueck.
 *
 * Was auf ihn zeigte, geht mit ihm: ein Weg von oder zu ihm (req-006) ergibt
 * ohne ihn keinen Sinn, und eine Wahl unter Alternativen (req-004) hat ohne
 * ihn kein Ziel. Sonst bliebe ein Fremdschluessel ins Leere zeigen.
 *
 * Liefert null, wenn es im Account keinen solchen Programmpunkt gibt.
 */
export async function deleteActivity(
  db: Queryable,
  accountId: string,
  activityId: string,
): Promise<Activity | null> {
  const vorhanden = await activityRow(db, accountId, activityId);
  if (!vorhanden) return null;

  await db.query(
    `delete from transfer where from_activity_id = $1 or to_activity_id = $1`,
    [activityId],
  );
  await db.query(
    `delete from activity_option_selection where selected_activity_id = $1`,
    [activityId],
  );
  await db.query(`delete from activity where id = $1`, [activityId]);

  return toActivity(vorhanden);
}
