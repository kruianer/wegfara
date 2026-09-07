import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type {
  Transfer,
  TransferMode,
  TransferValues,
} from "../transfers/types";

interface TransferRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  from_activity_id: string;
  to_activity_id: string;
  mode: TransferMode;
  title: string;
  duration_min: number;
  distance_km: number;
}

function toTransfer(row: TransferRow): Transfer {
  return {
    id: row.id,
    tripId: row.trip_id,
    fromActivityId: row.from_activity_id,
    toActivityId: row.to_activity_id,
    mode: row.mode,
    title: row.title,
    durationMin: row.duration_min,
    distanceKm: row.distance_km,
  };
}

const TRANSFER_COLUMNS = `id, trip_id, from_activity_id, to_activity_id,
                          mode, title, duration_min, distance_km`;

/** Dieselben Spalten, qualifiziert fuer die Abfragen mit Verknuepfung. */
const TRANSFER_COLUMNS_JOINED = `tr.id, tr.trip_id, tr.from_activity_id, tr.to_activity_id,
                                 tr.mode, tr.title, tr.duration_min, tr.distance_km`;

/** Alle Transfers aller Reisen des Accounts (Mandantentrennung ueber trip). */
export async function listTransfers(
  db: Queryable,
  accountId: string,
): Promise<Transfer[]> {
  const { rows } = await db.query<TransferRow>(
    `select ${TRANSFER_COLUMNS_JOINED}
     from transfer tr
     join trip t on t.id = tr.trip_id
     where t.account_id = $1`,
    [accountId],
  );
  return rows.map(toTransfer);
}

/** Ein einzelner Transfer des Accounts; null, wenn es ihn dort nicht gibt. */
export async function findTransfer(
  db: Queryable,
  accountId: string,
  transferId: string,
): Promise<Transfer | null> {
  const { rows } = await db.query<TransferRow>(
    `select ${TRANSFER_COLUMNS_JOINED}
     from transfer tr
     join trip t on t.id = tr.trip_id
     where tr.id = $1 and t.account_id = $2`,
    [transferId, accountId],
  );
  return rows[0] ? toTransfer(rows[0]) : null;
}

/**
 * Der Transfer zwischen genau diesen beiden Programmpunkten (req-052) --
 * mehr als einen gibt es dort nicht (siehe
 * migrations/0036_transfer_eindeutig.sql).
 */
export async function findTransferBetween(
  db: Queryable,
  accountId: string,
  fromActivityId: string,
  toActivityId: string,
): Promise<Transfer | null> {
  const { rows } = await db.query<TransferRow>(
    `select ${TRANSFER_COLUMNS_JOINED}
     from transfer tr
     join trip t on t.id = tr.trip_id
     where tr.from_activity_id = $1 and tr.to_activity_id = $2
       and t.account_id = $3`,
    [fromActivityId, toActivityId, accountId],
  );
  return rows[0] ? toTransfer(rows[0]) : null;
}

/**
 * Legt den Transfer zwischen zwei Programmpunkten an (req-052). Zu welcher
 * Reise er gehoert, sagt der Aufrufer nicht: das ergibt sich aus dem
 * Programmpunkt, von dem er ausgeht -- und der gehoert zu diesem Account
 * (req-024). Liefert null, wenn es diesen Programmpunkt dort nicht gibt.
 */
export async function createTransfer(
  db: Queryable,
  accountId: string,
  values: TransferValues,
): Promise<Transfer | null> {
  const tripId = await tripOfActivities(
    db,
    accountId,
    values.fromActivityId,
    values.toActivityId,
  );
  if (!tripId) return null;

  const { rows } = await db.query<TransferRow>(
    `insert into transfer (id, trip_id, from_activity_id, to_activity_id,
                           mode, title, duration_min, distance_km)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning ${TRANSFER_COLUMNS}`,
    [
      randomUUID(),
      tripId,
      values.fromActivityId,
      values.toActivityId,
      values.mode,
      values.title,
      values.durationMin,
      values.distanceKm,
    ],
  );
  return toTransfer(rows[0]);
}

/**
 * Aendert Verkehrsmittel, Titel, Dauer und Strecke eines Transfers
 * (req-052). Zwischen welchen beiden Programmpunkten er liegt, bleibt --
 * ein Transfer wandert nicht, er wird angelegt oder entfernt.
 */
export async function updateTransfer(
  db: Queryable,
  accountId: string,
  transferId: string,
  values: Omit<TransferValues, "fromActivityId" | "toActivityId">,
): Promise<Transfer | null> {
  if (!(await findTransfer(db, accountId, transferId))) return null;

  const { rows } = await db.query<TransferRow>(
    `update transfer
     set mode = $2, title = $3, duration_min = $4, distance_km = $5
     where id = $1
     returning ${TRANSFER_COLUMNS}`,
    [
      transferId,
      values.mode,
      values.title,
      values.durationMin,
      values.distanceKm,
    ],
  );
  return rows[0] ? toTransfer(rows[0]) : null;
}

/** Entfernt einen Transfer und liefert ihn zurueck; null, wenn es ihn nicht gibt. */
export async function deleteTransfer(
  db: Queryable,
  accountId: string,
  transferId: string,
): Promise<Transfer | null> {
  const vorhanden = await findTransfer(db, accountId, transferId);
  if (!vorhanden) return null;

  await db.query(`delete from transfer where id = $1`, [transferId]);
  return vorhanden;
}

/**
 * Die Reise, zu der beide Programmpunkte gehoeren -- null, wenn sie zu
 * verschiedenen Reisen gehoeren oder einer davon nicht zu diesem Account
 * (req-024). Ein Transfer verbindet zwei Programmpunkte derselben Reise
 * (req-006).
 */
async function tripOfActivities(
  db: Queryable,
  accountId: string,
  fromActivityId: string,
  toActivityId: string,
): Promise<string | null> {
  if (fromActivityId === toActivityId) return null;

  const { rows } = await db.query<{ id: string; trip_id: string }>(
    `select a.id, a.trip_id
     from activity a
     join trip t on t.id = a.trip_id
     where a.id in ($1, $2) and t.account_id = $3`,
    [fromActivityId, toActivityId, accountId],
  );
  // Beide muessen gefunden worden sein und zur selben Reise gehoeren.
  if (rows.length !== 2 || rows[0].trip_id !== rows[1].trip_id) return null;

  return rows[0].trip_id;
}
