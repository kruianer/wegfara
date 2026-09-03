import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { PoiPhoto } from "../pois/types";

interface PoiPhotoRow extends Record<string, unknown> {
  id: string;
  poi_id: string;
  position: number;
  file_name: string;
}

/**
 * Die Fotos aller POIs des Accounts, nach POI gebuendelt (req-026). Die
 * Mandantentrennung laeuft wie bei den POIs ueber die Reise.
 */
export async function listPoiPhotos(
  db: Queryable,
  accountId: string,
): Promise<Map<string, PoiPhoto[]>> {
  const { rows } = await db.query<PoiPhotoRow>(
    `select f.id, f.poi_id, f.position, f.file_name
     from poi_photo f
     join poi p on p.id = f.poi_id
     join trip t on t.id = p.trip_id
     where t.account_id = $1
     order by f.poi_id, f.position asc`,
    [accountId],
  );

  const byPoi = new Map<string, PoiPhoto[]>();
  for (const row of rows) {
    const photos = byPoi.get(row.poi_id) ?? [];
    photos.push({ id: row.id, position: row.position });
    byPoi.set(row.poi_id, photos);
  }
  return byPoi;
}

/** Die Fotos eines einzelnen POI, in ihrer Reihenfolge. */
export async function listPhotosOfPoi(
  db: Queryable,
  poiId: string,
): Promise<PoiPhoto[]> {
  const { rows } = await db.query<PoiPhotoRow>(
    `select id, poi_id, position, file_name from poi_photo
     where poi_id = $1 order by position asc`,
    [poiId],
  );
  return rows.map((row) => ({ id: row.id, position: row.position }));
}

/**
 * Der Dateiname eines Fotos, aber nur wenn es zu einem POI einer Reise
 * dieses Accounts gehoert (Mandantentrennung, req-024). Liefert null, wenn
 * es fuer diesen Account kein solches Foto gibt.
 */
export async function findPhotoFileName(
  db: Queryable,
  accountId: string,
  photoId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ file_name: string }>(
    `select f.file_name
     from poi_photo f
     join poi p on p.id = f.poi_id
     join trip t on t.id = p.trip_id
     where f.id = $1 and t.account_id = $2`,
    [photoId, accountId],
  );
  return rows[0]?.file_name ?? null;
}

/**
 * Ersetzt die Fotos eines POI durch die uebergebenen Dateien (req-026:
 * beim Auffrischen gelten die neuen Angaben). Liefert die Dateinamen der
 * abgeloesten Fotos zurueck — der Aufrufer entfernt sie aus der Ablage,
 * damit keine verwaisten Dateien zurueckbleiben (siehe stack.md).
 */
export async function replacePoiPhotos(
  db: Queryable,
  poiId: string,
  fileNames: string[],
  now: Date,
): Promise<{ photos: PoiPhoto[]; removedFileNames: string[] }> {
  const { rows: alt } = await db.query<{ file_name: string }>(
    `select file_name from poi_photo where poi_id = $1`,
    [poiId],
  );
  await db.query(`delete from poi_photo where poi_id = $1`, [poiId]);

  const photos: PoiPhoto[] = [];
  let position = 1;
  for (const fileName of fileNames) {
    const id = randomUUID();
    await db.query(
      `insert into poi_photo (id, poi_id, position, file_name, created_at)
       values ($1, $2, $3, $4, $5)`,
      [id, poiId, position, fileName, now],
    );
    photos.push({ id, position });
    position++;
  }

  return { photos, removedFileNames: alt.map((row) => row.file_name) };
}

/**
 * Die Dateinamen aller Fotos einer Reise. Wird vor dem Loeschen der Reise
 * gebraucht: mit den POIs verschwinden ihre Fotos, und ihre Dateien duerfen
 * nicht zurueckbleiben (req-026, Constraints).
 */
export async function listPhotoFileNamesOfTrip(
  db: Queryable,
  tripId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ file_name: string }>(
    `select f.file_name
     from poi_photo f
     join poi p on p.id = f.poi_id
     where p.trip_id = $1`,
    [tripId],
  );
  return rows.map((row) => row.file_name);
}
