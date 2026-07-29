import type { Queryable } from "./queryable";
import type { Transfer, TransferMode } from "../transfers/types";

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

/** Alle Transfers aller Reisen des Accounts (Mandantentrennung ueber trip). */
export async function listTransfers(
  db: Queryable,
  accountId: string,
): Promise<Transfer[]> {
  const { rows } = await db.query<TransferRow>(
    `select tr.id, tr.trip_id, tr.from_activity_id, tr.to_activity_id,
            tr.mode, tr.title, tr.duration_min, tr.distance_km
     from transfer tr
     join trip t on t.id = tr.trip_id
     where t.account_id = $1`,
    [accountId],
  );
  return rows.map(toTransfer);
}
