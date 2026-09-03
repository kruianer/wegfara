import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { Trip } from "../trips/types";
import type { TripInput } from "../trips/validate";

interface TripRow extends Record<string, unknown> {
  id: string;
  title: string;
  start_date: unknown;
  end_date: unknown;
  main_place_name: string;
  main_place_lat: number;
  main_place_lng: number;
}

function toIsoDateString(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    title: row.title,
    startDate: toIsoDateString(row.start_date),
    endDate: toIsoDateString(row.end_date),
    mainPlace: {
      name: row.main_place_name,
      lat: row.main_place_lat,
      lng: row.main_place_lng,
    },
  };
}

export async function listTrips(
  db: Queryable,
  accountId: string,
): Promise<Trip[]> {
  const { rows } = await db.query<TripRow>(
    `select id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng
     from trip
     where account_id = $1
     order by start_date asc`,
    [accountId],
  );
  return rows.map(toTrip);
}

/** Ob die Reise zum Account gehoert — jeder schreibende Zugriff prueft das. */
async function belongsToAccount(
  db: Queryable,
  tripId: string,
  accountId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select id from trip where id = $1 and account_id = $2`,
    [tripId, accountId],
  );
  return rows.length > 0;
}

/** Legt eine neue Reise im Account an (siehe req-017). */
export async function createTrip(
  db: Queryable,
  accountId: string,
  input: TripInput,
): Promise<Trip> {
  const id = randomUUID();
  await db.query(
    `insert into trip (id, account_id, title, start_date, end_date,
                       main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      accountId,
      input.title,
      input.startDate,
      input.endDate,
      input.mainPlace.name,
      input.mainPlace.lat,
      input.mainPlace.lng,
    ],
  );
  return {
    id,
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    mainPlace: input.mainPlace,
  };
}

/**
 * Korrigiert Titel, Zeitraum und Hauptort einer Reise (siehe req-017).
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function updateTrip(
  db: Queryable,
  accountId: string,
  tripId: string,
  input: TripInput,
): Promise<Trip | null> {
  if (!(await belongsToAccount(db, tripId, accountId))) return null;

  await db.query(
    `update trip
     set title = $3, start_date = $4, end_date = $5,
         main_place_name = $6, main_place_lat = $7, main_place_lng = $8
     where id = $1 and account_id = $2`,
    [
      tripId,
      accountId,
      input.title,
      input.startDate,
      input.endDate,
      input.mainPlace.name,
      input.mainPlace.lat,
      input.mainPlace.lng,
    ],
  );
  return {
    id: tripId,
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    mainPlace: input.mainPlace,
  };
}

/**
 * Loescht eine Reise samt aller daran haengenden Daten (siehe req-017,
 * Constraints: keine verwaisten Daten). Die Reihenfolge folgt den
 * Fremdschluesseln: erst was auf Programmpunkte und POIs zeigt, dann diese
 * selbst, zuletzt die Reise.
 *
 * Liefert false, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function deleteTrip(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<boolean> {
  if (!(await belongsToAccount(db, tripId, accountId))) return false;

  await db.query(`delete from activity_option_selection where trip_id = $1`, [
    tripId,
  ]);
  await db.query(`delete from transfer where trip_id = $1`, [tripId]);
  await db.query(`delete from activity where trip_id = $1`, [tripId]);
  await db.query(`delete from poi where trip_id = $1`, [tripId]);
  await db.query(
    `delete from search_area_point
     where search_area_id in (select id from search_area where trip_id = $1)`,
    [tripId],
  );
  await db.query(`delete from search_area where trip_id = $1`, [tripId]);
  // Mit der Reise endet auch, wer bei ihr mitgefahren waere (req-021); die
  // Personen selbst bleiben am Account.
  await db.query(`delete from trip_participant where trip_id = $1`, [tripId]);
  await db.query(`delete from trip where id = $1 and account_id = $2`, [
    tripId,
    accountId,
  ]);
  return true;
}
