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
 * Woher ein Foto stammt (req-035): aus dem Google-Import (req-026) oder von
 * Hand hinzugefuegt. Beim Auffrischen werden nur die aus Google ersetzt.
 */
export type PoiPhotoSource = "google" | "manuell";

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

/** Die Dateinamen aller Fotos eines POI — gebraucht vor dem Loeschen (req-035). */
export async function listPhotoFileNamesOfPoi(
  db: Queryable,
  poiId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ file_name: string }>(
    `select file_name from poi_photo where poi_id = $1 order by position asc`,
    [poiId],
  );
  return rows.map((row) => row.file_name);
}

/** Ob der POI zu einer Reise dieses Accounts gehoert (Mandantentrennung, req-024). */
async function poiGehoertZuAccount(
  db: Queryable,
  accountId: string,
  poiId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select p.id
     from poi p
     join trip t on t.id = p.trip_id
     where p.id = $1 and t.account_id = $2`,
    [poiId, accountId],
  );
  return rows.length > 0;
}

/**
 * Setzt die Reihenfolge der Fotos eines POI auf die uebergebenen Kennungen.
 *
 * Zweistufig, weil `position` je POI eindeutig ist: erst werden alle
 * Positionen ins Negative gedreht, dann eine nach der anderen gesetzt --
 * sonst kollidierte das Umsortieren mit sich selbst.
 */
async function setzePositionen(
  db: Queryable,
  poiId: string,
  ids: string[],
): Promise<PoiPhoto[]> {
  await db.query(
    `update poi_photo set position = -position where poi_id = $1`,
    [poiId],
  );
  let position = 1;
  for (const id of ids) {
    await db.query(`update poi_photo set position = $2 where id = $1`, [
      id,
      position,
    ]);
    position++;
  }
  return ids.map((id, index) => ({ id, position: index + 1 }));
}

/**
 * Fuegt einem POI ein von Hand hochgeladenes Foto hinzu (req-035). Es haengt
 * sich hinten an; die Reihenfolge aendert der Nutzer danach selbst.
 *
 * Liefert die Fotos des POI in ihrer neuen Reihenfolge — oder null, wenn es
 * im Account keinen solchen POI gibt (req-024).
 */
export async function addPoiPhoto(
  db: Queryable,
  accountId: string,
  poiId: string,
  fileName: string,
  now: Date,
): Promise<PoiPhoto[] | null> {
  if (!(await poiGehoertZuAccount(db, accountId, poiId))) return null;

  const vorhandene = await listPhotosOfPoi(db, poiId);
  const id = randomUUID();
  await db.query(
    `insert into poi_photo (id, poi_id, position, file_name, created_at, source)
     values ($1, $2, $3, $4, $5, 'manuell')`,
    [id, poiId, vorhandene.length + 1, fileName, now],
  );
  return [...vorhandene, { id, position: vorhandene.length + 1 }];
}

/**
 * Entfernt ein einzelnes Foto (req-035) und schliesst die Luecke in der
 * Reihenfolge. Liefert den Dateinamen, damit der Aufrufer die Datei aus der
 * Ablage raeumt — kein Datensatz ohne Datei, keine Datei ohne Datensatz
 * (stack.md) — oder null, wenn es im Account kein solches Foto gibt.
 */
export async function deletePoiPhoto(
  db: Queryable,
  accountId: string,
  photoId: string,
): Promise<{ poiId: string; fileName: string; photos: PoiPhoto[] } | null> {
  const { rows } = await db.query<PoiPhotoRow>(
    `select f.id, f.poi_id, f.position, f.file_name
     from poi_photo f
     join poi p on p.id = f.poi_id
     join trip t on t.id = p.trip_id
     where f.id = $1 and t.account_id = $2`,
    [photoId, accountId],
  );
  const vorhanden = rows[0];
  if (!vorhanden) return null;

  await db.query(`delete from poi_photo where id = $1`, [photoId]);
  const uebrige = await listPhotosOfPoi(db, vorhanden.poi_id);
  const photos = await setzePositionen(
    db,
    vorhanden.poi_id,
    uebrige.map((photo) => photo.id),
  );

  return { poiId: vorhanden.poi_id, fileName: vorhanden.file_name, photos };
}

/**
 * Ordnet die Fotos eines POI neu (req-035) — das erste erscheint in der
 * POI-Zeile. Kennungen, die nicht zu diesem POI gehoeren, werden
 * uebergangen; nicht genannte Fotos haengen sich in ihrer bisherigen
 * Reihenfolge hinten an, damit nie eines verschwindet.
 *
 * Liefert null, wenn es im Account keinen solchen POI gibt (req-024).
 */
export async function reorderPoiPhotos(
  db: Queryable,
  accountId: string,
  poiId: string,
  photoIds: string[],
): Promise<PoiPhoto[] | null> {
  if (!(await poiGehoertZuAccount(db, accountId, poiId))) return null;

  const vorhandene = await listPhotosOfPoi(db, poiId);
  const bekannt = new Set(vorhandene.map((photo) => photo.id));
  const gewuenscht = photoIds.filter((id) => bekannt.has(id));
  const rest = vorhandene
    .map((photo) => photo.id)
    .filter((id) => !gewuenscht.includes(id));

  return setzePositionen(db, poiId, [...gewuenscht, ...rest]);
}

/**
 * Ersetzt die Fotos aus Google durch die uebergebenen Dateien (req-026:
 * beim Auffrischen gelten die neuen Angaben). Von Hand hinzugefuegte Fotos
 * bleiben erhalten und stehen danach vorn (req-035) — sonst waere jedes
 * selbst hochgeladene Bild beim naechsten Einfuegen des Links weg.
 *
 * Liefert die Dateinamen der abgeloesten Fotos zurueck — der Aufrufer
 * entfernt sie aus der Ablage, damit keine verwaisten Dateien
 * zurueckbleiben (siehe stack.md).
 */
export async function replacePoiPhotos(
  db: Queryable,
  poiId: string,
  fileNames: string[],
  now: Date,
): Promise<{ photos: PoiPhoto[]; removedFileNames: string[] }> {
  const { rows: alt } = await db.query<PoiPhotoRow & { source: string }>(
    `select id, poi_id, position, file_name, source from poi_photo
     where poi_id = $1 order by position asc`,
    [poiId],
  );
  const ausGoogle = alt.filter((row) => row.source !== "manuell");
  const vonHand = alt.filter((row) => row.source === "manuell");

  await db.query(
    `delete from poi_photo where poi_id = $1 and source <> 'manuell'`,
    [poiId],
  );
  await setzePositionen(
    db,
    poiId,
    vonHand.map((row) => row.id),
  );

  const photos: PoiPhoto[] = vonHand.map((row, index) => ({
    id: row.id,
    position: index + 1,
  }));
  let position = photos.length + 1;
  for (const fileName of fileNames) {
    const id = randomUUID();
    await db.query(
      `insert into poi_photo (id, poi_id, position, file_name, created_at, source)
       values ($1, $2, $3, $4, $5, 'google')`,
      [id, poiId, position, fileName, now],
    );
    photos.push({ id, position });
    position++;
  }

  return { photos, removedFileNames: ausGoogle.map((row) => row.file_name) };
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
