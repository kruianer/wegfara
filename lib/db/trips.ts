import type { Queryable } from "./queryable";
import type { Trip } from "../trips/types";

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
