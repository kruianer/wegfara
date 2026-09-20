import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { PoiPhoto, PoiPhotoSource } from "../pois/types";

interface PoiPhotoRow extends Record<string, unknown> {
  id: string;
  poi_id: string;
  position: number;
  file_name: string;
  source: PoiPhotoSource;
}

/**
 * Die Herkunft geht bei jedem Lesen mit: an ihr haengt das Symbol des
 * KI-Bildes (req-072), und geraten wird sie nie.
 */
function toPoiPhoto(row: PoiPhotoRow): PoiPhoto {
  return { id: row.id, position: row.position, source: row.source };
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
    `select f.id, f.poi_id, f.position, f.file_name, f.source
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
    photos.push(toPoiPhoto(row));
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
    `select id, poi_id, position, file_name, source from poi_photo
     where poi_id = $1 order by position asc`,
    [poiId],
  );
  return rows.map(toPoiPhoto);
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
  // Gelesen statt zusammengesetzt: so traegt jedes Foto seine Herkunft auch
  // nach dem Umsortieren (req-072) und nicht nur Kennung und Platz.
  return listPhotosOfPoi(db, poiId);
}

/**
 * Fuegt einem POI ein Foto hinzu, das nicht aus Google stammt: ein von Hand
 * hochgeladenes (req-035) oder ein erzeugtes (req-072). Es haengt sich hinten
 * an; die Reihenfolge aendert der Nutzer danach selbst.
 *
 * Die Herkunft steht in der Datenbank und wird nicht aus dem Dateinamen
 * vermutet (req-072, Constraints) — an ihr haengt das Symbol des KI-Bildes.
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
  source: PoiPhotoSource = "manuell",
): Promise<PoiPhoto[] | null> {
  if (!(await poiGehoertZuAccount(db, accountId, poiId))) return null;

  const vorhandene = await listPhotosOfPoi(db, poiId);
  const id = randomUUID();
  await db.query(
    `insert into poi_photo (id, poi_id, position, file_name, created_at, source)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, poiId, vorhandene.length + 1, fileName, now, source],
  );
  return [...vorhandene, { id, position: vorhandene.length + 1, source }];
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
    `select f.id, f.poi_id, f.position, f.file_name, f.source
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
 * beim Auffrischen gelten die neuen Angaben). Alles, was nicht aus Google
 * kam, bleibt erhalten und steht danach vorn — von Hand hinzugefuegte Fotos
 * (req-035) ebenso wie erzeugte (req-072); sonst waere ein selbst
 * hochgeladenes oder erzeugtes Bild beim naechsten Einfuegen des Links weg.
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
  const { rows: alt } = await db.query<PoiPhotoRow>(
    `select id, poi_id, position, file_name, source from poi_photo
     where poi_id = $1 order by position asc`,
    [poiId],
  );
  const ausGoogle = alt.filter((row) => row.source === "google");
  const eigene = alt.filter((row) => row.source !== "google");

  await db.query(
    `delete from poi_photo where poi_id = $1 and source = 'google'`,
    [poiId],
  );
  const photos = await setzePositionen(
    db,
    poiId,
    eigene.map((row) => row.id),
  );

  let position = photos.length + 1;
  for (const fileName of fileNames) {
    const id = randomUUID();
    await db.query(
      `insert into poi_photo (id, poi_id, position, file_name, created_at, source)
       values ($1, $2, $3, $4, $5, 'google')`,
      [id, poiId, position, fileName, now],
    );
    photos.push({ id, position, source: "google" });
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
