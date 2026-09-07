import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type {
  Bewertungsrunde,
  RundenStatus,
  Stimme,
  StimmWahl,
} from "../bewertungen/types";

/**
 * Die Bewertungsrunden einer Reise und die Stimmen dazu (req-054).
 *
 * Mandantentrennung wie bei `poi` und `activity`: jede Abfrage verknuepft bis
 * `trip.account_id`, der Account kommt aus der Anmeldung und nie aus der
 * Anfrage (req-024).
 */

interface RoundRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  status: RundenStatus;
  started_at: unknown;
  ended_at: unknown;
}

interface VoteRow extends Record<string, unknown> {
  round_id: string;
  poi_id: string;
  participant_id: string;
  choice: StimmWahl;
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toRunde(row: RoundRow, poiIds: string[]): Bewertungsrunde {
  return {
    id: row.id,
    tripId: row.trip_id,
    status: row.status,
    poiIds,
    startedAt: toIso(row.started_at),
    endedAt: row.ended_at === null ? null : toIso(row.ended_at),
  };
}

function toStimme(row: VoteRow): Stimme {
  return {
    roundId: row.round_id,
    poiId: row.poi_id,
    participantId: row.participant_id,
    wahl: row.choice,
  };
}

/** Die POIs je Runde, in der Reihenfolge ihrer Nummer innerhalb der Reise. */
async function poiIdsJeRunde(
  db: Queryable,
  accountId: string,
): Promise<Map<string, string[]>> {
  const { rows } = await db.query<{ round_id: string; poi_id: string }>(
    `select rp.round_id, rp.poi_id
     from rating_round_poi rp
     join rating_round r on r.id = rp.round_id
     join trip t on t.id = r.trip_id
     join poi p on p.id = rp.poi_id
     where t.account_id = $1
     order by p.number asc`,
    [accountId],
  );
  const jeRunde = new Map<string, string[]>();
  for (const row of rows) {
    const vorhanden = jeRunde.get(row.round_id);
    if (vorhanden) vorhanden.push(row.poi_id);
    else jeRunde.set(row.round_id, [row.poi_id]);
  }
  return jeRunde;
}

/** Alle Bewertungsrunden aller Reisen des Accounts, die neueste zuerst. */
export async function listRatingRounds(
  db: Queryable,
  accountId: string,
): Promise<Bewertungsrunde[]> {
  const { rows } = await db.query<RoundRow>(
    `select r.id, r.trip_id, r.status, r.started_at, r.ended_at
     from rating_round r
     join trip t on t.id = r.trip_id
     where t.account_id = $1
     order by r.started_at desc`,
    [accountId],
  );
  const poiIds = await poiIdsJeRunde(db, accountId);
  return rows.map((row) => toRunde(row, poiIds.get(row.id) ?? []));
}

/**
 * Alle abgegebenen Stimmen des Accounts -- auch die zu beendeten Runden: sie
 * bleiben erhalten und sichtbar (req-054).
 */
export async function listRatingVotes(
  db: Queryable,
  accountId: string,
): Promise<Stimme[]> {
  const { rows } = await db.query<VoteRow>(
    `select v.round_id, v.poi_id, v.participant_id, v.choice
     from rating_vote v
     join rating_round r on r.id = v.round_id
     join trip t on t.id = r.trip_id
     where t.account_id = $1`,
    [accountId],
  );
  return rows.map(toStimme);
}

/**
 * Warum eine Runde nicht gestartet oder beendet werden konnte (req-054):
 * `unknown` -- Reise, Runde oder POI gehoeren nicht zu diesem Account,
 * `notLeader` -- die Person ist nicht Reiseleiter dieser Reise,
 * `laeuft` -- zu dieser Reise laeuft bereits eine Runde,
 * `keinePois` -- es wurde kein POI der Reise ausgewaehlt.
 */
export type RundenFehler = "unknown" | "notLeader" | "laeuft" | "keinePois";

export type RundenErgebnis =
  | { ok: true; runde: Bewertungsrunde }
  | { ok: false; reason: RundenFehler };

/** Ob diese Person die Reise fuehrt -- und ob die Reise zum Account gehoert. */
async function fuehrtReise(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
): Promise<{ bekannt: boolean; reiseleiter: boolean }> {
  const { rows: reisen } = await db.query(
    `select id from trip where id = $2 and account_id = $1`,
    [accountId, tripId],
  );
  if (reisen.length === 0) return { bekannt: false, reiseleiter: false };

  const { rows } = await db.query<{ role: string }>(
    `select role from trip_participant
     where trip_id = $1 and participant_id = $2`,
    [tripId, participantId],
  );
  return {
    bekannt: true,
    reiseleiter: rows.some((row) => row.role === "reiseleiter"),
  };
}

/**
 * Startet eine Bewertungsrunde ueber die ausgewaehlten POIs (req-054). Nur der
 * Reiseleiter der Reise darf das -- geprueft wird es hier und damit auch bei
 * einem Aufruf an der Oberflaeche vorbei.
 *
 * Zu einer Reise laeuft hoechstens eine Runde; POIs anderer Reisen bleiben
 * aussen vor.
 */
export async function startRatingRound(
  db: Queryable,
  accountId: string,
  participantId: string,
  tripId: string,
  poiIds: string[],
  now: Date,
): Promise<RundenErgebnis> {
  const { bekannt, reiseleiter } = await fuehrtReise(
    db,
    accountId,
    tripId,
    participantId,
  );
  if (!bekannt) return { ok: false, reason: "unknown" };
  if (!reiseleiter) return { ok: false, reason: "notLeader" };

  const { rows: laufende } = await db.query(
    `select id from rating_round where trip_id = $1 and status = 'laeuft'`,
    [tripId],
  );
  if (laufende.length > 0) return { ok: false, reason: "laeuft" };

  // Nur POIs dieser Reise -- eine Kennung aus der Anfrage taugt nicht als
  // Nachweis, dass der POI ueberhaupt dazugehoert (req-024).
  const { rows: pois } = await db.query<{ id: string }>(
    `select id from poi where trip_id = $1 order by number asc`,
    [tripId],
  );
  const gewaehlt = pois
    .filter((poi) => poiIds.includes(poi.id))
    .map((poi) => poi.id);
  if (gewaehlt.length === 0) return { ok: false, reason: "keinePois" };

  const id = randomUUID();
  await db.query(
    `insert into rating_round (id, trip_id, status, started_at, ended_at)
     values ($1, $2, 'laeuft', $3, null)`,
    [id, tripId, now],
  );
  for (const poiId of gewaehlt) {
    await db.query(
      `insert into rating_round_poi (round_id, poi_id) values ($1, $2)`,
      [id, poiId],
    );
  }

  return {
    ok: true,
    runde: {
      id,
      tripId,
      status: "laeuft",
      poiIds: gewaehlt,
      startedAt: now.toISOString(),
      endedAt: null,
    },
  };
}

/**
 * Beendet eine laufende Runde (req-054). Die Stimmen bleiben erhalten und
 * sichtbar; neue lassen sich nicht mehr abgeben. Nur der Reiseleiter der
 * Reise darf beenden.
 */
export async function endRatingRound(
  db: Queryable,
  accountId: string,
  participantId: string,
  roundId: string,
  now: Date,
): Promise<RundenErgebnis> {
  const { rows } = await db.query<RoundRow>(
    `select r.id, r.trip_id, r.status, r.started_at, r.ended_at
     from rating_round r
     join trip t on t.id = r.trip_id
     where r.id = $2 and t.account_id = $1`,
    [accountId, roundId],
  );
  const vorhanden = rows[0];
  if (!vorhanden) return { ok: false, reason: "unknown" };

  const { reiseleiter } = await fuehrtReise(
    db,
    accountId,
    vorhanden.trip_id,
    participantId,
  );
  if (!reiseleiter) return { ok: false, reason: "notLeader" };

  const poiIds = (await poiIdsJeRunde(db, accountId)).get(roundId) ?? [];
  // Eine bereits beendete Runde bleibt beendet -- das Beenden ist kein
  // Umschalter, und ihr Zeitpunkt darf sich nicht nachtraeglich verschieben.
  if (vorhanden.status === "beendet") {
    return { ok: true, runde: toRunde(vorhanden, poiIds) };
  }

  await db.query(
    `update rating_round set status = 'beendet', ended_at = $2 where id = $1`,
    [roundId, now],
  );
  return {
    ok: true,
    runde: {
      ...toRunde(vorhanden, poiIds),
      status: "beendet",
      endedAt: now.toISOString(),
    },
  };
}

/**
 * Warum eine Stimme nicht angenommen wurde (req-054):
 * `unknown` -- Runde oder POI gehoeren nicht zu diesem Account oder der POI
 *   steht nicht in dieser Runde,
 * `notInTrip` -- die Person gehoert nicht zu dieser Reise,
 * `beendet` -- die Runde laeuft nicht mehr.
 */
export type StimmFehler = "unknown" | "notInTrip" | "beendet";

export type StimmErgebnis =
  | { ok: true; stimme: Stimme }
  | { ok: false; reason: StimmFehler };

/**
 * Nimmt die Stimme einer Person zu einem POI der laufenden Runde entgegen
 * (req-054). Solange die Runde laeuft, ersetzt eine neue Stimme die vorherige.
 *
 * Abstimmen darf nur, wer zu dieser Reise gehoert -- die Stimme gehoert zur
 * Zuordnung zwischen Person und Reise (req-054, Constraints).
 *
 * Geschrieben wird sofort, nicht gebuendelt (siehe delivery/stack.md): die
 * Stimme ist das, was die anderen sehen -- eine verzoegerte Schreibung zeigte
 * ihnen einen Stand, den es nicht mehr gibt.
 */
export async function castVote(
  db: Queryable,
  accountId: string,
  participantId: string,
  roundId: string,
  poiId: string,
  wahl: StimmWahl,
  now: Date,
): Promise<StimmErgebnis> {
  const { rows } = await db.query<{ trip_id: string; status: RundenStatus }>(
    `select r.trip_id, r.status
     from rating_round r
     join rating_round_poi rp on rp.round_id = r.id and rp.poi_id = $3
     join trip t on t.id = r.trip_id
     where r.id = $2 and t.account_id = $1`,
    [accountId, roundId, poiId],
  );
  const runde = rows[0];
  if (!runde) return { ok: false, reason: "unknown" };

  const { rows: zuordnung } = await db.query(
    `select role from trip_participant
     where trip_id = $1 and participant_id = $2`,
    [runde.trip_id, participantId],
  );
  if (zuordnung.length === 0) return { ok: false, reason: "notInTrip" };

  if (runde.status !== "laeuft") return { ok: false, reason: "beendet" };

  await db.query(
    `insert into rating_vote (round_id, poi_id, participant_id, choice, voted_at)
     values ($1, $2, $3, $4, $5)
     on conflict (round_id, poi_id, participant_id) do update
       set choice = excluded.choice,
           voted_at = excluded.voted_at`,
    [roundId, poiId, participantId, wahl, now],
  );
  return { ok: true, stimme: { roundId, poiId, participantId, wahl } };
}

/**
 * Ob diese Person in einer laufenden Runde noch nicht ueberall gestimmt hat
 * (req-023, "offene Bewertung"). Wer eine offene Bewertung hat, bleibt
 * angemeldet -- auch ohne freigegebene Reise.
 *
 * Ohne Mandantenfilter wie leadsAnyTrip: die Zuordnung haengt an der Person,
 * und der Account ergibt sich aus ihr.
 */
export async function hasOpenRating(
  db: Queryable,
  participantId: string,
): Promise<boolean> {
  const { rows: offen } = await db.query<{
    round_id: string;
    poi_id: string;
  }>(
    `select rp.round_id, rp.poi_id
     from rating_round r
     join rating_round_poi rp on rp.round_id = r.id
     join trip_participant tp on tp.trip_id = r.trip_id
     where r.status = 'laeuft' and tp.participant_id = $1`,
    [participantId],
  );
  if (offen.length === 0) return false;

  const { rows: abgegeben } = await db.query<{
    round_id: string;
    poi_id: string;
  }>(`select round_id, poi_id from rating_vote where participant_id = $1`, [
    participantId,
  ]);
  const gestimmt = new Set(
    abgegeben.map((row) => `${row.round_id}:${row.poi_id}`),
  );
  return offen.some((row) => !gestimmt.has(`${row.round_id}:${row.poi_id}`));
}
