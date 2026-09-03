import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import { listPhotosOfPoi, listPoiPhotos } from "./poi-photos";
import type { Poi, PoiPosition, PoiStatus, PoiType } from "../pois/types";
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
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  google_place_id: string | null;
}

const POI_COLUMNS = `id, trip_id, number, name, ort, type, lat, lng,
                     status, web, address, phone, opening_hours, google_place_id`;

/** Dieselben Spalten, qualifiziert fuer die Abfragen mit Verknuepfung. */
const POI_COLUMNS_JOINED = `p.id, p.trip_id, p.number, p.name, p.ort, p.type, p.lat, p.lng,
                            p.status, p.web, p.address, p.phone, p.opening_hours, p.google_place_id`;

/** Die Oeffnungszeiten liegen als Text ab, eine Zeile je Wochentag (req-026). */
function toOpeningHours(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const lines = raw.split("\n").filter((line) => line.length > 0);
  return lines.length > 0 ? lines : undefined;
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
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    openingHours: toOpeningHours(row.opening_hours),
    googlePlaceId: row.google_place_id ?? undefined,
    photos: [],
  };
}

/**
 * Alle POIs aller Reisen des Accounts (Mandantentrennung ueber trip),
 * jeweils mit ihren Fotos (req-026).
 */
export async function listPois(
  db: Queryable,
  accountId: string,
): Promise<Poi[]> {
  const { rows } = await db.query<PoiRow>(
    `select ${POI_COLUMNS_JOINED}
     from poi p
     join trip t on t.id = p.trip_id
     where t.account_id = $1
     order by p.name asc`,
    [accountId],
  );
  const photos = await listPoiPhotos(db, accountId);
  return rows.map((row) => ({
    ...toPoi(row),
    photos: photos.get(row.id) ?? [],
  }));
}

/**
 * Setzt den Status eines POI (siehe req-010, Constraints: nur der
 * Reiseleiter). Der Account stammt aus der Anmeldung, die POI-Kennung aus
 * der Anfrage — deshalb wird mitgeprueft, ob der POI ueberhaupt zu einer
 * Reise dieses Accounts gehoert (req-024).
 *
 * Liefert false, wenn es im Account keinen solchen POI gibt.
 */
export async function setPoiStatus(
  db: Queryable,
  accountId: string,
  poiId: string,
  status: PoiStatus,
): Promise<boolean> {
  const { rows } = await db.query(
    `update poi
     set status = $3
     where id = $1
       and trip_id in (select id from trip where account_id = $2)
     returning id`,
    [poiId, accountId, status],
  );
  return rows.length > 0;
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
  let nextNumber = await naechsteNummer(db, tripId);

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
      photos: [],
    });
    nextNumber++;
  }
  return created;
}

async function naechsteNummer(db: Queryable, tripId: string): Promise<number> {
  const { rows } = await db.query<{ max: number | null }>(
    `select max(number) as max from poi where trip_id = $1`,
    [tripId],
  );
  return (rows[0]?.max ?? 0) + 1;
}

/** Die Angaben eines bei Google nachgeschlagenen Ortes (siehe req-026). */
export interface PoiFromGoogle {
  googlePlaceId: string;
  name: string;
  ort: string;
  type: PoiType;
  position: PoiPosition;
  web?: string;
  address?: string;
  phone?: string;
  openingHours?: string[];
}

async function tripGehoertZuAccount(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select id from trip where id = $1 and account_id = $2`,
    [tripId, accountId],
  );
  return rows.length > 0;
}

/**
 * Sucht denselben Ort in der Reise (req-026): zuerst ueber die Kennung bei
 * Google, sonst ueber den Namen — so wird auch ein von Hand oder per
 * KI-Suche angelegter POI aufgefrischt statt verdoppelt.
 */
async function vorhandenerPoi(
  db: Queryable,
  tripId: string,
  data: PoiFromGoogle,
): Promise<PoiRow | null> {
  const { rows } = await db.query<PoiRow>(
    `select ${POI_COLUMNS} from poi where trip_id = $1`,
    [tripId],
  );
  const gleicherName = data.name.trim().toLowerCase();
  return (
    rows.find((row) => row.google_place_id === data.googlePlaceId) ??
    rows.find((row) => row.name.trim().toLowerCase() === gleicherName) ??
    null
  );
}

/**
 * Legt den bei Google nachgeschlagenen Ort als POI der Reise an — oder
 * frischt ihn auf, wenn er dort schon steht (siehe req-026). Beim
 * Auffrischen bleiben Nummer und Status erhalten; ein neuer POI bekommt
 * die naechste freie Nummer und den Status "Weiß noch nicht".
 *
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert (req-024).
 */
export async function savePoiFromGoogle(
  db: Queryable,
  accountId: string,
  tripId: string,
  data: PoiFromGoogle,
): Promise<{ poi: Poi; created: boolean } | null> {
  if (!(await tripGehoertZuAccount(db, accountId, tripId))) return null;

  const openingHours = data.openingHours?.join("\n") ?? null;
  const werte = [
    data.name,
    data.ort,
    data.type,
    data.position.lat,
    data.position.lng,
    data.web ?? null,
    data.address ?? null,
    data.phone ?? null,
    openingHours,
    data.googlePlaceId,
  ];

  const vorhanden = await vorhandenerPoi(db, tripId, data);
  if (vorhanden) {
    const { rows } = await db.query<PoiRow>(
      `update poi
       set name = $2, ort = $3, type = $4, lat = $5, lng = $6, web = $7,
           address = $8, phone = $9, opening_hours = $10, google_place_id = $11
       where id = $1
       returning ${POI_COLUMNS}`,
      [vorhanden.id, ...werte],
    );
    const poi = toPoi(rows[0]);
    poi.photos = await listPhotosOfPoi(db, poi.id);
    return { poi, created: false };
  }

  const id = randomUUID();
  const number = await naechsteNummer(db, tripId);
  const { rows } = await db.query<PoiRow>(
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status,
                      web, address, phone, opening_hours, google_place_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'weiss_nicht', $9, $10, $11, $12, $13)
     returning ${POI_COLUMNS}`,
    [id, tripId, number, ...werte],
  );
  return { poi: toPoi(rows[0]), created: true };
}
