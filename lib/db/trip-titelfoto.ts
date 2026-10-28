import type { Queryable } from "./queryable";
import type { TitelfotoQuelle, TripTitelfoto } from "../trips/titelfoto";

/**
 * Das Titelfoto einer Reise (req-103). Je Reise hoechstens eines; die
 * Mandantentrennung laeuft ueber die Reise (req-024).
 *
 * Wer ein eigenes Bild ersetzt oder die Wahl zuruecknimmt, bekommt dessen
 * Dateinamen zurueck und raeumt die Datei aus der Ablage -- kein Bild ohne
 * Datensatz, keine Datei ohne Datensatz (stack.md).
 */

interface TitelfotoRow extends Record<string, unknown> {
  trip_id: string;
  poi_photo_id: string | null;
  file_name: string | null;
  source: "poi" | TitelfotoQuelle;
  created_at: unknown;
}

function zeitpunkt(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toTitelfoto(row: TitelfotoRow): TripTitelfoto {
  if (row.source === "poi" && row.poi_photo_id) {
    return { tripId: row.trip_id, art: "poi", photoId: row.poi_photo_id };
  }
  return {
    tripId: row.trip_id,
    art: "eigen",
    istKiBild: row.source === "ki",
    stand: zeitpunkt(row.created_at),
  };
}

/** Die Titelfotos aller Reisen des Accounts. */
export async function listTripTitelfotos(
  db: Queryable,
  accountId: string,
): Promise<TripTitelfoto[]> {
  const { rows } = await db.query<TitelfotoRow>(
    `select f.trip_id, f.poi_photo_id, f.file_name, f.source, f.created_at
     from trip_titelfoto f
     join trip t on t.id = f.trip_id
     where t.account_id = $1`,
    [accountId],
  );
  return rows.map(toTitelfoto);
}

/** Das Titelfoto einer Reise des Accounts -- null, wenn keines gewaehlt ist. */
export async function findTripTitelfoto(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<TripTitelfoto | null> {
  const { rows } = await db.query<TitelfotoRow>(
    `select f.trip_id, f.poi_photo_id, f.file_name, f.source, f.created_at
     from trip_titelfoto f
     join trip t on t.id = f.trip_id
     where t.account_id = $1 and f.trip_id = $2`,
    [accountId, tripId],
  );
  return rows[0] ? toTitelfoto(rows[0]) : null;
}

/**
 * Der Dateiname des eigenen Titelfotos einer Reise des Accounts -- null, wenn
 * sie keines hat oder nicht zu diesem Account gehoert.
 */
export async function findEigenesTitelfotoFileName(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ file_name: string | null }>(
    `select f.file_name
     from trip_titelfoto f
     join trip t on t.id = f.trip_id
     where t.account_id = $1 and f.trip_id = $2`,
    [accountId, tripId],
  );
  return rows[0]?.file_name ?? null;
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

/** Entfernt die bisherige Wahl und nennt die Datei eines eigenen Bildes. */
async function entferneBisherige(
  db: Queryable,
  tripId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ file_name: string | null }>(
    `select file_name from trip_titelfoto where trip_id = $1`,
    [tripId],
  );
  await db.query(`delete from trip_titelfoto where trip_id = $1`, [tripId]);
  return rows[0]?.file_name ?? null;
}

/**
 * Waehlt ein Foto eines POI dieser Reise als Titelfoto. Ein Foto einer
 * anderen Reise -- oder eines anderen Accounts -- laesst sich nicht waehlen.
 *
 * Liefert null, wenn Reise oder Foto nicht passen; sonst die neue Wahl und
 * den Dateinamen eines abgeloesten eigenen Bildes.
 */
export async function waehlePoiTitelfoto(
  db: Queryable,
  accountId: string,
  tripId: string,
  photoId: string,
  now: Date,
): Promise<{
  titelfoto: TripTitelfoto;
  removedFileName: string | null;
} | null> {
  const { rows } = await db.query(
    `select f.id
     from poi_photo f
     join poi p on p.id = f.poi_id
     join trip t on t.id = p.trip_id
     where f.id = $1 and p.trip_id = $2 and t.account_id = $3`,
    [photoId, tripId, accountId],
  );
  if (rows.length === 0) return null;

  const removedFileName = await entferneBisherige(db, tripId);
  await db.query(
    `insert into trip_titelfoto (trip_id, poi_photo_id, file_name, source, created_at)
     values ($1, $2, null, 'poi', $3)`,
    [tripId, photoId, now],
  );
  return {
    titelfoto: { tripId, art: "poi", photoId },
    removedFileName,
  };
}

/**
 * Legt ein eigenes Bild als Titelfoto ab -- hochgeladen oder erzeugt. Die
 * Datei liegt da bereits; scheitert dieser Schritt, entfernt der Aufrufer sie
 * wieder.
 *
 * Liefert null, wenn die Reise nicht zum Account gehoert.
 */
export async function setzeEigenesTitelfoto(
  db: Queryable,
  accountId: string,
  tripId: string,
  fileName: string,
  quelle: TitelfotoQuelle,
  now: Date,
): Promise<{
  titelfoto: TripTitelfoto;
  removedFileName: string | null;
} | null> {
  if (!(await tripGehoertZuAccount(db, accountId, tripId))) return null;

  const removedFileName = await entferneBisherige(db, tripId);
  await db.query(
    `insert into trip_titelfoto (trip_id, poi_photo_id, file_name, source, created_at)
     values ($1, null, $2, $3, $4)`,
    [tripId, fileName, quelle, now],
  );
  return {
    titelfoto: {
      tripId,
      art: "eigen",
      istKiBild: quelle === "ki",
      stand: now.toISOString(),
    },
    removedFileName,
  };
}

/**
 * Nimmt die Wahl zurueck -- der Plan nimmt dann wieder die Vorgabe. Liefert
 * null, wenn die Reise nicht zum Account gehoert.
 */
export async function entferneTitelfoto(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<{ removedFileName: string | null } | null> {
  if (!(await tripGehoertZuAccount(db, accountId, tripId))) return null;
  return { removedFileName: await entferneBisherige(db, tripId) };
}
