import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { Poi, PoiStatus, PoiType } from "../pois/types";
import type { PoiDraft } from "../pois/ai-search";

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

/**
 * Legt neue POIs einer Reise an, mit fortlaufender Nummer ab der naechsten
 * freien (siehe req-013) und Status "Weiß noch nicht" (siehe req-014).
 */
export async function createPois(
  db: Queryable,
  tripId: string,
  drafts: PoiDraft[],
): Promise<Poi[]> {
  const { rows } = await db.query<{ max: number | null }>(
    `select max(number) as max from poi where trip_id = $1`,
    [tripId],
  );
  let nextNumber = (rows[0]?.max ?? 0) + 1;

  const created: Poi[] = [];
  for (const draft of drafts) {
    const id = randomUUID();
    await db.query(
      `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status, web)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'weiss_nicht', $9)`,
      [
        id,
        tripId,
        nextNumber,
        draft.name,
        draft.ort,
        draft.type,
        draft.position.lat,
        draft.position.lng,
        draft.web ?? null,
      ],
    );
    created.push({
      id,
      tripId,
      number: nextNumber,
      name: draft.name,
      ort: draft.ort,
      type: draft.type,
      position: draft.position,
      status: "weiss_nicht",
      web: draft.web,
    });
    nextNumber++;
  }
  return created;
}
