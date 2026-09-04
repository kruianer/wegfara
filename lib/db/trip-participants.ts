import type { Queryable } from "./queryable";
import type { TripParticipant, TripRole } from "../trip-participants/types";
import {
  canRemoveFromTrip,
  canSetRole,
  promoteLeadersWhereMissing,
} from "../trip-participants/rules";

interface TripParticipantRow extends Record<string, unknown> {
  trip_id: string;
  participant_id: string;
  role: TripRole;
}

/**
 * Warum eine Zuordnung nicht geaendert werden konnte (req-021):
 * `unknown` -- Reise oder Person gehoeren nicht zu diesem Account,
 * `lastLeader` -- es waere der letzte Reiseleiter der Reise gewesen.
 */
export type TripParticipantFailure = "unknown" | "lastLeader";

export type TripParticipantResult =
  | { ok: true; tripParticipant: TripParticipant }
  | { ok: false; reason: TripParticipantFailure };

function toTripParticipant(row: TripParticipantRow): TripParticipant {
  return {
    tripId: row.trip_id,
    participantId: row.participant_id,
    role: row.role,
  };
}

/**
 * Alle Zuordnungen des Accounts, geordnet nach dem Alter der Person -- so
 * steht in jeder Reise dieselbe Reihenfolge wie in der Personenliste, und
 * beim Nachruecken eines Reiseleiters ist die dienstaelteste Person die
 * erste (siehe promoteLeadersWhereMissing).
 *
 * Reisen anderer Mandanten bleiben aussen vor: gefiltert wird ueber die
 * Reise, die am Account haengt.
 */
export async function listTripParticipants(
  db: Queryable,
  accountId: string,
): Promise<TripParticipant[]> {
  const { rows } = await db.query<TripParticipantRow>(
    `select tp.trip_id, tp.participant_id, tp.role
     from trip_participant tp
     join trip t on t.id = tp.trip_id
     join participant p on p.id = tp.participant_id
     where t.account_id = $1
     order by p.created_at asc, p.name asc`,
    [accountId],
  );
  return rows.map(toTripParticipant);
}

/**
 * Ob diese Person mindestens eine Reise fuehrt (req-023). Der Reiseleiter
 * ist von den Einschraenkungen ausgenommen, die fuer Teilnehmer gelten: er
 * bleibt angemeldet, auch wenn gerade keine Reise freigegeben ist, und er
 * bekommt als Einziger Notfallcodes -- ihn kann niemand wieder hereinholen.
 *
 * Ohne Mandantenfilter: die Rolle haengt an der Person selbst, und der
 * Account ergibt sich aus ihr (siehe lib/db/participants.ts).
 */
export async function leadsAnyTrip(
  db: Queryable,
  participantId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select trip_id from trip_participant
     where participant_id = $1 and role = 'reiseleiter'`,
    [participantId],
  );
  return rows.length > 0;
}

/**
 * Ob diese Person mindestens einer freigegebenen Reise zugeordnet ist
 * (req-023). Massgeblich ist der Zustand der Reise, nicht ihr Datum:
 * Vorbereitung beginnt Wochen vorher, die Abrechnung zieht sich danach.
 */
export async function isInReleasedTrip(
  db: Queryable,
  participantId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select tp.trip_id
     from trip_participant tp
     join trip t on t.id = tp.trip_id
     where tp.participant_id = $1 and t.state = 'freigegeben'`,
    [participantId],
  );
  return rows.length > 0;
}

/**
 * Ob diese Person einer Reise dieses Accounts zugeordnet ist. Eingeladen
 * wird nur, wer mitfaehrt (req-023) -- eine bloss erfasste Person braucht
 * keinen Zugang.
 */
export async function isInAnyTrip(
  db: Queryable,
  accountId: string,
  participantId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select tp.trip_id
     from trip_participant tp
     join trip t on t.id = tp.trip_id
     where tp.participant_id = $1 and t.account_id = $2`,
    [participantId, accountId],
  );
  return rows.length > 0;
}

/** Ob Reise und Person beide zu diesem Account gehoeren. */
async function bothInAccount(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select t.id
     from trip t, participant p
     where t.id = $2 and t.account_id = $1
       and p.id = $3 and p.account_id = $1`,
    [accountId, tripId, participantId],
  );
  return rows.length > 0;
}

/**
 * Ordnet eine Person der Reise zu oder aendert ihre Rolle (req-021). Eine
 * Person kann derselben Reise nur einmal zugeordnet sein -- eine bestehende
 * Zuordnung wird deshalb geaendert, nicht verdoppelt.
 *
 * Der letzte Reiseleiter laesst sich nicht zum Teilnehmer herabstufen.
 */
export async function assignTripParticipant(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
  role: TripRole,
): Promise<TripParticipantResult> {
  if (!(await bothInAccount(db, accountId, tripId, participantId))) {
    return { ok: false, reason: "unknown" };
  }

  const assignments = await listTripParticipants(db, accountId);
  const existing = assignments.find(
    (assignment) =>
      assignment.tripId === tripId &&
      assignment.participantId === participantId,
  );

  if (!canSetRole(assignments, tripId, participantId, role)) {
    return { ok: false, reason: "lastLeader" };
  }

  if (existing) {
    await db.query(
      `update trip_participant set role = $3
       where trip_id = $1 and participant_id = $2`,
      [tripId, participantId, role],
    );
  } else {
    await db.query(
      `insert into trip_participant (trip_id, participant_id, role)
       values ($1, $2, $3)`,
      [tripId, participantId, role],
    );
  }
  return { ok: true, tripParticipant: { tripId, participantId, role } };
}

/**
 * Nimmt eine Person aus der Reise (req-021). Der letzte Reiseleiter bleibt
 * zugeordnet -- eine Reise hat immer mindestens einen.
 */
export async function removeTripParticipant(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
): Promise<{ ok: true } | { ok: false; reason: TripParticipantFailure }> {
  if (!(await bothInAccount(db, accountId, tripId, participantId))) {
    return { ok: false, reason: "unknown" };
  }

  const assignments = await listTripParticipants(db, accountId);
  const zugeordnet = assignments.some(
    (assignment) =>
      assignment.tripId === tripId &&
      assignment.participantId === participantId,
  );
  if (!zugeordnet) return { ok: false, reason: "unknown" };

  if (!canRemoveFromTrip(assignments, tripId, participantId)) {
    return { ok: false, reason: "lastLeader" };
  }

  await db.query(
    `delete from trip_participant where trip_id = $1 and participant_id = $2`,
    [tripId, participantId],
  );
  return { ok: true };
}

/**
 * Laesst in jede Reise, die ihren letzten Reiseleiter verloren hat, die
 * dienstaelteste verbliebene Person nachruecken (req-021). Aufzurufen,
 * nachdem eine Person aus dem Account entfernt wurde -- ihre Zuordnungen
 * verschwinden mit ihr (siehe migrations/0020_trip_participant.sql).
 */
export async function promoteLeadersInAccount(
  db: Queryable,
  accountId: string,
): Promise<void> {
  const assignments = await listTripParticipants(db, accountId);
  const promoted = promoteLeadersWhereMissing(assignments);

  for (const [index, assignment] of promoted.entries()) {
    if (assignment.role === assignments[index].role) continue;
    await db.query(
      `update trip_participant set role = $3
       where trip_id = $1 and participant_id = $2`,
      [assignment.tripId, assignment.participantId, assignment.role],
    );
  }
}
