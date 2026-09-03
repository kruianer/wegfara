import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { PoiPosition } from "../pois/types";
import type { SearchArea } from "../pois/search-area";
import { tripBelongsToAccount } from "./trips";

interface SearchAreaPointRow extends Record<string, unknown> {
  trip_id: string;
  lat: number;
  lng: number;
}

/** Alle Suchgebiete des Accounts, Eckpunkte je Reise nach Position geordnet. */
export async function listSearchAreas(
  db: Queryable,
  accountId: string,
): Promise<SearchArea[]> {
  const { rows } = await db.query<SearchAreaPointRow>(
    `select sa.trip_id, sp.lat, sp.lng
     from search_area sa
     join trip t on t.id = sa.trip_id
     join search_area_point sp on sp.search_area_id = sa.id
     where t.account_id = $1
     order by sa.trip_id asc, sp.position asc`,
    [accountId],
  );

  const byTrip = new Map<string, PoiPosition[]>();
  for (const row of rows) {
    const points = byTrip.get(row.trip_id) ?? [];
    points.push({ lat: row.lat, lng: row.lng });
    byTrip.set(row.trip_id, points);
  }
  return Array.from(byTrip, ([tripId, points]) => ({ tripId, points }));
}

/**
 * Ersetzt das Suchgebiet einer Reise durch die angegebenen Eckpunkte (siehe
 * req-012: hoechstens eines je Reise, ein neu gezeichnetes ersetzt das alte).
 *
 * Der Account stammt aus der Anmeldung, die Reise aus der Anfrage — gehoert
 * sie nicht zu diesem Account, passiert nichts und es kommt false zurueck
 * (req-024).
 */
export async function setSearchArea(
  db: Queryable,
  accountId: string,
  tripId: string,
  points: PoiPosition[],
): Promise<boolean> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return false;

  await db.query(`delete from search_area where trip_id = $1`, [tripId]);
  const searchAreaId = randomUUID();
  await db.query(`insert into search_area (id, trip_id) values ($1, $2)`, [
    searchAreaId,
    tripId,
  ]);
  for (const [position, point] of points.entries()) {
    await db.query(
      `insert into search_area_point (id, search_area_id, position, lat, lng)
       values ($1, $2, $3, $4, $5)`,
      [randomUUID(), searchAreaId, position, point.lat, point.lng],
    );
  }
  return true;
}

/**
 * Entfernt das Suchgebiet einer Reise wieder. Liefert false, wenn die Reise
 * nicht zu diesem Account gehoert (req-024).
 */
export async function clearSearchArea(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<boolean> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return false;

  await db.query(`delete from search_area where trip_id = $1`, [tripId]);
  return true;
}
