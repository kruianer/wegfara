import type { Queryable } from "./queryable";
import type { GeteiltePosition } from "../positions/types";
import { tripBelongsToAccount } from "./trips";

interface TripPositionRow extends Record<string, unknown> {
  trip_id: string;
  participant_id: string;
  lat: number;
  lng: number;
  ort: string | null;
  recorded_at: unknown;
}

function toPosition(row: TripPositionRow): GeteiltePosition {
  return {
    tripId: row.trip_id,
    participantId: row.participant_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    ort: row.ort,
    recordedAt:
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : String(row.recorded_at),
  };
}

const POSITION_COLUMNS = `trip_id, participant_id, lat, lng, ort, recorded_at`;

/**
 * Die geteilten Positionen einer Reise -- je Teilnehmer hoechstens eine.
 * Reisen anderer Mandanten bleiben aussen vor: gefiltert wird immer nach
 * dem Account aus der Anmeldung (req-024).
 */
export async function listTripPositions(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<GeteiltePosition[]> {
  const { rows } = await db.query<TripPositionRow>(
    `select ${POSITION_COLUMNS} from trip_position
     where account_id = $1 and trip_id = $2
     order by recorded_at desc`,
    [accountId, tripId],
  );
  return rows.map(toPosition);
}

/** Was zu einer Messung gespeichert wird; `ort` darf fehlen. */
export interface PositionsWerte {
  lat: number;
  lng: number;
  ort?: string | null;
}

/**
 * Legt die Position eines Teilnehmers ab oder ueberschreibt seine
 * vorherige. Ein Standort geht sofort in die Ablage -- eine verzoegerte
 * Sammelschreibung (siehe stack.md) waere hier sinnlos, weil jede Messung
 * die vorherige ohnehin ersetzt.
 *
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function saveTripPosition(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
  werte: PositionsWerte,
  now: Date,
): Promise<GeteiltePosition | null> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return null;

  const { rows } = await db.query<TripPositionRow>(
    `insert into trip_position
       (trip_id, participant_id, account_id, lat, lng, ort, recorded_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (trip_id, participant_id) do update
       set lat = excluded.lat,
           lng = excluded.lng,
           ort = excluded.ort,
           recorded_at = excluded.recorded_at
     returning ${POSITION_COLUMNS}`,
    [
      tripId,
      participantId,
      accountId,
      werte.lat,
      werte.lng,
      werte.ort ?? null,
      now,
    ],
  );
  return rows[0] ? toPosition(rows[0]) : null;
}

/**
 * Nimmt die Position eines Teilnehmers wieder aus der Ablage -- sie
 * verschwindet damit sofort aus dem Live-Status der anderen.
 */
export async function deleteTripPosition(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
): Promise<void> {
  await db.query(
    `delete from trip_position
     where account_id = $1 and trip_id = $2 and participant_id = $3`,
    [accountId, tripId, participantId],
  );
}
