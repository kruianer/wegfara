import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { DocumentDraft, TripDocument } from "../documents/types";

interface DocumentRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  name: string;
  content_type: string;
  size_bytes: number;
  page_count: number | null;
  poi_id: string | null;
  transfer_id: string | null;
  uploaded_by: string | null;
  created_at: unknown;
}

const DOCUMENT_COLUMNS = `d.id, d.trip_id, d.name, d.content_type, d.size_bytes,
                          d.page_count, d.poi_id, d.transfer_id, d.uploaded_by,
                          d.created_at`;

/** `timestamptz` liefert der Treiber als Date, das Test-Double als Text. */
function toIsoInstant(value: unknown): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function toDocument(row: DocumentRow): TripDocument {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    pageCount: row.page_count === null ? null : Number(row.page_count),
    poiId: row.poi_id,
    transferId: row.transfer_id,
    uploadedById: row.uploaded_by,
    createdAt: toIsoInstant(row.created_at),
  };
}

/**
 * Alle Dokumente aller Reisen des Accounts (Mandantentrennung ueber trip),
 * das neueste zuerst (req-034).
 */
export async function listDocuments(
  db: Queryable,
  accountId: string,
): Promise<TripDocument[]> {
  const { rows } = await db.query<DocumentRow>(
    `select ${DOCUMENT_COLUMNS}
     from document d
     join trip t on t.id = d.trip_id
     where t.account_id = $1
     order by d.created_at desc, d.id desc`,
    [accountId],
  );
  return rows.map(toDocument);
}

/**
 * Warum ein Dokument nicht geschrieben werden konnte:
 * `unknown` -- Reise oder Dokument gehoeren nicht zu diesem Account,
 * `notInTrip` -- der verknuepfte POI oder Transfer gehoert zu einer anderen
 * Reise. Ein Dokument wird nur mit einem POI oder Transfer **dieser** Reise
 * verknuepft (req-034).
 */
export type DocumentFailure = "unknown" | "notInTrip";

export type DocumentResult =
  | { ok: true; document: TripDocument }
  | { ok: false; reason: DocumentFailure };

/** Die Angaben eines abzulegenden Dokuments, wie sie in die Datenbank gehen. */
export interface DocumentFields extends DocumentDraft {
  /** Der von der Anwendung vergebene Name in der Ablage (nie der hochgeladene). */
  fileName: string;
  contentType: string;
  sizeBytes: number;
  pageCount: number | null;
  uploadedById: string | null;
}

async function tripInAccount(
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
 * Ob die gewuenschte Verknuepfung zu dieser Reise gehoert. Ohne
 * Verknuepfung ist nichts zu pruefen; beides zugleich gibt es nicht.
 */
async function linkBelongsToTrip(
  db: Queryable,
  tripId: string,
  draft: DocumentDraft,
): Promise<boolean> {
  if (draft.poiId && draft.transferId) return false;
  if (draft.poiId) {
    const { rows } = await db.query(
      `select id from poi where id = $1 and trip_id = $2`,
      [draft.poiId, tripId],
    );
    return rows.length > 0;
  }
  if (draft.transferId) {
    const { rows } = await db.query(
      `select id from transfer where id = $1 and trip_id = $2`,
      [draft.transferId, tripId],
    );
    return rows.length > 0;
  }
  return true;
}

async function readDocument(
  db: Queryable,
  documentId: string,
): Promise<TripDocument | null> {
  const { rows } = await db.query<DocumentRow>(
    `select ${DOCUMENT_COLUMNS} from document d where d.id = $1`,
    [documentId],
  );
  return rows[0] ? toDocument(rows[0]) : null;
}

/**
 * Legt den Datensatz zu einer bereits geschriebenen Datei an (req-034).
 * Reihenfolge beim Ablegen: erst die Datei, dann der Datensatz -- scheitert
 * er, entfernt der Aufrufer die Datei wieder.
 */
export async function createDocument(
  db: Queryable,
  accountId: string,
  tripId: string,
  fields: DocumentFields,
  now: Date,
): Promise<DocumentResult> {
  if (!(await tripInAccount(db, accountId, tripId))) {
    return { ok: false, reason: "unknown" };
  }
  if (!(await linkBelongsToTrip(db, tripId, fields))) {
    return { ok: false, reason: "notInTrip" };
  }

  const id = randomUUID();
  await db.query(
    `insert into document (id, trip_id, name, file_name, content_type,
                           size_bytes, page_count, poi_id, transfer_id,
                           uploaded_by, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      tripId,
      fields.name,
      fields.fileName,
      fields.contentType,
      fields.sizeBytes,
      fields.pageCount,
      fields.poiId,
      fields.transferId,
      fields.uploadedById,
      now,
    ],
  );

  const document = await readDocument(db, id);
  return document ? { ok: true, document } : { ok: false, reason: "unknown" };
}

/** Die Reise eines Dokuments, sofern beide zu diesem Account gehoeren. */
async function tripOfDocument(
  db: Queryable,
  accountId: string,
  documentId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ trip_id: string }>(
    `select d.trip_id
     from document d
     join trip t on t.id = d.trip_id
     where d.id = $1 and t.account_id = $2`,
    [documentId, accountId],
  );
  return rows[0]?.trip_id ?? null;
}

/**
 * Aendert Name und Verknuepfung eines Dokuments (req-034). Die Datei selbst
 * wird nie ersetzt -- dafuer wird ein neues Dokument abgelegt und das alte
 * entfernt.
 */
export async function updateDocument(
  db: Queryable,
  accountId: string,
  documentId: string,
  draft: DocumentDraft,
): Promise<DocumentResult> {
  const tripId = await tripOfDocument(db, accountId, documentId);
  if (!tripId) return { ok: false, reason: "unknown" };
  if (!(await linkBelongsToTrip(db, tripId, draft))) {
    return { ok: false, reason: "notInTrip" };
  }

  await db.query(
    `update document set name = $2, poi_id = $3, transfer_id = $4
     where id = $1`,
    [documentId, draft.name, draft.poiId, draft.transferId],
  );

  const document = await readDocument(db, documentId);
  return document ? { ok: true, document } : { ok: false, reason: "unknown" };
}

/**
 * Entfernt den Datensatz und liefert den Namen seiner Datei zurueck --
 * der Aufrufer raeumt sie danach aus der Ablage (req-034: erst der
 * Datensatz, dann die Datei; scheitert die Datei, bleibt kein Datensatz
 * zurueck, der ins Leere zeigt).
 *
 * Liefert null, wenn es im Account kein solches Dokument gibt.
 */
export async function deleteDocument(
  db: Queryable,
  accountId: string,
  documentId: string,
): Promise<{ fileName: string } | null> {
  if (!(await tripOfDocument(db, accountId, documentId))) return null;

  const { rows } = await db.query<{ file_name: string }>(
    `delete from document where id = $1 returning file_name`,
    [documentId],
  );
  return rows[0] ? { fileName: rows[0].file_name } : null;
}

/**
 * Die Datei zu einem Dokument -- aber nur, wenn es zu einer Reise dieses
 * Accounts gehoert (Mandantentrennung, req-024). Fuer ein Dokument eines
 * anderen Accounts gibt es fuer diese Sitzung nichts.
 */
export async function findDocumentFile(
  db: Queryable,
  accountId: string,
  documentId: string,
): Promise<{ fileName: string; contentType: string; name: string } | null> {
  const { rows } = await db.query<{
    file_name: string;
    content_type: string;
    name: string;
  }>(
    `select d.file_name, d.content_type, d.name
     from document d
     join trip t on t.id = d.trip_id
     where d.id = $1 and t.account_id = $2`,
    [documentId, accountId],
  );
  const row = rows[0];
  return row
    ? { fileName: row.file_name, contentType: row.content_type, name: row.name }
    : null;
}

/**
 * Die Dateinamen aller Dokumente einer Reise. Wird vor dem Loeschen der
 * Reise gebraucht: mit ihr verschwinden ihre Dokumente, und ihre Dateien
 * duerfen nicht zurueckbleiben (req-034).
 */
export async function listDocumentFileNamesOfTrip(
  db: Queryable,
  tripId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ file_name: string }>(
    `select file_name from document where trip_id = $1`,
    [tripId],
  );
  return rows.map((row) => row.file_name);
}

/** Ein Datensatz, wie ihn die taegliche Pruefung braucht (req-034). */
export interface DocumentFileRef {
  id: string;
  name: string;
  fileName: string;
}

/**
 * Alle Datensaetze mit ihrem Dateinamen -- ausschliesslich fuer die
 * taegliche Pruefung von Datei und Datensatz gegeneinander (req-034).
 *
 * Das ist bewusst keine Abfrage ueber Mandanten hinweg im Sinne von
 * delivery/stack.md: sie liefert keine Nutzerdaten an eine Sitzung aus,
 * sondern haelt die Ablage in Ordnung. Sie laeuft ohne Sitzung, im
 * Hintergrund, und was sie liest, verlaesst den Server nicht.
 */
export async function listDocumentFileRefs(
  db: Queryable,
): Promise<DocumentFileRef[]> {
  const { rows } = await db.query<{
    id: string;
    name: string;
    file_name: string;
  }>(`select id, name, file_name from document`);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    fileName: row.file_name,
  }));
}
