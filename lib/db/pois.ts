import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import {
  listPhotoFileNamesOfPoi,
  listPhotosOfPoi,
  listPoiPhotos,
} from "./poi-photos";
import type {
  Poi,
  PoiPosition,
  PoiStatus,
  PoiType,
  PoiValues,
} from "../pois/types";
import type { PoiDraft } from "../pois/ai-search";
import {
  changedPoiFields,
  mergeGooglePoiUpdate,
  parseManualFields,
  serializeManualFields,
  withManualFields,
  type PoiFieldValues,
} from "../pois/manual-fields";

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
  manual_fields: string;
}

const POI_COLUMNS = `id, trip_id, number, name, ort, type, lat, lng,
                     status, web, address, phone, opening_hours, google_place_id,
                     manual_fields`;

/** Dieselben Spalten, qualifiziert fuer die Abfragen mit Verknuepfung. */
const POI_COLUMNS_JOINED = `p.id, p.trip_id, p.number, p.name, p.ort, p.type, p.lat, p.lng,
                            p.status, p.web, p.address, p.phone, p.opening_hours, p.google_place_id,
                            p.manual_fields`;

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

function toFieldValues(row: PoiRow): PoiFieldValues {
  return {
    name: row.name,
    ort: row.ort,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    web: row.web,
    address: row.address,
    phone: row.phone,
    openingHours: row.opening_hours,
  };
}

/**
 * `bisher` ist der Ort, der stehen bleibt, wenn sich keiner ableiten liess
 * (req-041) -- bei einem neuen POI ist das der leere Ort.
 */
function valuesToFields(values: PoiValues, bisher: string): PoiFieldValues {
  const openingHours = values.openingHours?.join("\n") ?? null;
  return {
    name: values.name,
    ort: values.ort ?? bisher,
    type: values.type,
    lat: values.position.lat,
    lng: values.position.lng,
    web: values.web,
    address: values.address,
    phone: values.phone,
    openingHours: openingHours && openingHours.length > 0 ? openingHours : null,
  };
}

/**
 * Legt einen POI von Hand an (req-035): naechste freie Nummer (req-013) und
 * der uebergebene Status -- das Formular beginnt bei "Weiß noch nicht".
 *
 * Als von Hand geaendert gilt zunaechst nichts: ein spaeter eingefuegter
 * Google-Maps-Link darf einen selbst erfassten Ort noch ergaenzen. Erst was
 * danach von Hand geaendert wird, ist vor dem Import geschuetzt.
 *
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert (req-024).
 */
export async function createPoi(
  db: Queryable,
  accountId: string,
  tripId: string,
  values: PoiValues,
): Promise<Poi | null> {
  if (!(await tripGehoertZuAccount(db, accountId, tripId))) return null;

  // Ohne abgeleiteten Ort bleibt er beim neuen POI leer; seine Zeile in der
  // POI-Liste zeigt dann keine Ortsangabe (req-041).
  const felder = valuesToFields(values, "");
  const id = randomUUID();
  const number = await naechsteNummer(db, tripId);
  const { rows } = await db.query<PoiRow>(
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status,
                      web, address, phone, opening_hours)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning ${POI_COLUMNS}`,
    [
      id,
      tripId,
      number,
      felder.name,
      felder.ort,
      felder.type,
      felder.lat,
      felder.lng,
      values.status,
      felder.web,
      felder.address,
      felder.phone,
      felder.openingHours,
    ],
  );
  return toPoi(rows[0]);
}

/** Der POI, aber nur wenn er zu einer Reise dieses Accounts gehoert (req-024). */
async function poiRow(
  db: Queryable,
  accountId: string,
  poiId: string,
): Promise<PoiRow | null> {
  const { rows } = await db.query<PoiRow>(
    `select ${POI_COLUMNS_JOINED}
     from poi p
     join trip t on t.id = p.trip_id
     where p.id = $1 and t.account_id = $2`,
    [poiId, accountId],
  );
  return rows[0] ?? null;
}

/**
 * Ein einzelner POI des Accounts (req-039) -- was das Verplanen braucht:
 * Name, Position und Typ des POI werden zum Programmpunkt.
 *
 * Liefert null, wenn es im Account keinen solchen POI gibt (req-024).
 */
export async function findPoi(
  db: Queryable,
  accountId: string,
  poiId: string,
): Promise<Poi | null> {
  const row = await poiRow(db, accountId, poiId);
  return row ? toPoi(row) : null;
}

/**
 * Aendert die Angaben eines POI (req-035). Die Nummer bleibt fest -- ueber
 * sie wird in der Gruppe und auf der Karte gesprochen (req-013).
 *
 * Jede tatsaechlich geaenderte Angabe wird als "von Hand geaendert"
 * vermerkt: der naechste Google-Import laesst sie stehen (req-035). Was
 * unveraendert bleibt, bleibt auch unvermerkt.
 *
 * Liefert null, wenn es im Account keinen solchen POI gibt.
 */
export async function updatePoi(
  db: Queryable,
  accountId: string,
  poiId: string,
  values: PoiValues,
): Promise<Poi | null> {
  const vorhanden = await poiRow(db, accountId, poiId);
  if (!vorhanden) return null;

  // Liess sich kein Ort ableiten, bleibt der gespeicherte stehen (req-041).
  const neu = valuesToFields(values, vorhanden.ort);
  const manuell = withManualFields(
    parseManualFields(vorhanden.manual_fields),
    changedPoiFields(toFieldValues(vorhanden), neu),
  );

  const { rows } = await db.query<PoiRow>(
    `update poi
     set name = $2, ort = $3, type = $4, lat = $5, lng = $6, status = $7,
         web = $8, address = $9, phone = $10, opening_hours = $11,
         manual_fields = $12
     where id = $1
     returning ${POI_COLUMNS}`,
    [
      poiId,
      neu.name,
      neu.ort,
      neu.type,
      neu.lat,
      neu.lng,
      values.status,
      neu.web,
      neu.address,
      neu.phone,
      neu.openingHours,
      serializeManualFields(manuell),
    ],
  );

  const poi = toPoi(rows[0]);
  poi.photos = await listPhotosOfPoi(db, poi.id);
  return poi;
}

/**
 * Entfernt einen POI samt seinen Fotos (req-035). Ein Programmpunkt, der aus
 * ihm entstanden ist, bleibt bestehen und verliert nur die Verknuepfung --
 * er hat eine feste Zeit im Plan, die nicht mit dem POI verschwindet.
 *
 * Liefert die Dateinamen der entfernten Fotos: der Aufrufer raeumt sie aus
 * der Bildablage, damit keine verwaisten Dateien zurueckbleiben (stack.md).
 * Liefert null, wenn es im Account keinen solchen POI gibt.
 */
export async function deletePoi(
  db: Queryable,
  accountId: string,
  poiId: string,
): Promise<{ poi: Poi; removedFileNames: string[] } | null> {
  const vorhanden = await poiRow(db, accountId, poiId);
  if (!vorhanden) return null;

  const removedFileNames = await listPhotoFileNamesOfPoi(db, poiId);

  // Der Programmpunkt bleibt, seine Verknuepfung loest sich (req-035).
  await db.query(`update activity set poi_id = null where poi_id = $1`, [
    poiId,
  ]);
  // Dasselbe gilt fuer ein Dokument, das auf den POI zeigte (req-034).
  await db.query(`update document set poi_id = null where poi_id = $1`, [
    poiId,
  ]);
  await db.query(`delete from poi_photo where poi_id = $1`, [poiId]);
  await db.query(`delete from poi where id = $1`, [poiId]);

  return { poi: toPoi(vorhanden), removedFileNames };
}

/** Die Angaben eines bei Google nachgeschlagenen Ortes (siehe req-026). */
export interface PoiFromGoogle {
  googlePlaceId: string;
  name: string;
  /** Der abgeleitete Ort; null laesst den gespeicherten stehen (req-041). */
  ort: string | null;
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

  const vorhanden = await vorhandenerPoi(db, tripId, data);
  const ausGoogle = valuesToFields(
    {
      name: data.name,
      ort: data.ort,
      type: data.type,
      position: data.position,
      status: "weiss_nicht",
      web: data.web ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      openingHours: data.openingHours ?? null,
    },
    vorhanden?.ort ?? "",
  );

  if (vorhanden) {
    // Von Hand geaenderte Angaben bleiben stehen (req-035) -- sonst waere
    // jede Korrektur beim naechsten Einfuegen des Links wieder weg.
    const felder = mergeGooglePoiUpdate(
      toFieldValues(vorhanden),
      ausGoogle,
      parseManualFields(vorhanden.manual_fields),
    );
    const { rows } = await db.query<PoiRow>(
      `update poi
       set name = $2, ort = $3, type = $4, lat = $5, lng = $6, web = $7,
           address = $8, phone = $9, opening_hours = $10, google_place_id = $11
       where id = $1
       returning ${POI_COLUMNS}`,
      [
        vorhanden.id,
        felder.name,
        felder.ort,
        felder.type,
        felder.lat,
        felder.lng,
        felder.web,
        felder.address,
        felder.phone,
        felder.openingHours,
        data.googlePlaceId,
      ],
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
    [
      id,
      tripId,
      number,
      ausGoogle.name,
      ausGoogle.ort,
      ausGoogle.type,
      ausGoogle.lat,
      ausGoogle.lng,
      ausGoogle.web,
      ausGoogle.address,
      ausGoogle.phone,
      ausGoogle.openingHours,
      data.googlePlaceId,
    ],
  );
  return { poi: toPoi(rows[0]), created: true };
}
