import type { Queryable } from "./queryable";
import type { Poi, PoiStatus, PoiType } from "../pois/types";

interface PoiRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  number: number;
  name: string;
  ort: string;
  type: PoiType;
  lat: number;
  lng: number;
  status: PoiStatus;
  web: string | null;
}

function toPoi(row: PoiRow): Poi {
  return {
    id: row.id,
    tripId: row.trip_id,
    number: row.number,
    name: row.name,
    ort: row.ort,
    type: row.type,
    position: { lat: row.lat, lng: row.lng },
    status: row.status,
    web: row.web ?? undefined,
  };
}

/** Alle POIs aller Reisen des Accounts (Mandantentrennung ueber trip). */
export async function listPois(
  db: Queryable,
  accountId: string,
): Promise<Poi[]> {
  const { rows } = await db.query<PoiRow>(
    `select p.id, p.trip_id, p.number, p.name, p.ort, p.type, p.lat, p.lng, p.status, p.web
     from poi p
     join trip t on t.id = p.trip_id
     where t.account_id = $1
     order by p.name asc`,
    [accountId],
  );
  return rows.map(toPoi);
}

/** Setzt den Status eines POI (siehe req-010, Constraints: nur der Reiseleiter). */
export async function setPoiStatus(
  db: Queryable,
  poiId: string,
  status: PoiStatus,
): Promise<void> {
  await db.query(`update poi set status = $2 where id = $1`, [poiId, status]);
}
