import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type { Trip } from "../trips/types";
import type { TripInput } from "../trips/validate";
import type { Session } from "../auth/types";
import { DEFAULT_TRIP_STATE, type TripState } from "../trips/state";

interface TripRow extends Record<string, unknown> {
  id: string;
  title: string;
  start_date: unknown;
  end_date: unknown;
  main_place_name: string;
  main_place_lat: number;
  main_place_lng: number;
  state: TripState;
}

function toIsoDateString(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    title: row.title,
    startDate: toIsoDateString(row.start_date),
    endDate: toIsoDateString(row.end_date),
    mainPlace: {
      name: row.main_place_name,
      lat: row.main_place_lat,
      lng: row.main_place_lng,
    },
    state: row.state,
  };
}

export async function listTrips(
  db: Queryable,
  accountId: string,
): Promise<Trip[]> {
  const { rows } = await db.query<TripRow>(
    `select id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng, state
     from trip
     where account_id = $1
     order by start_date asc`,
    [accountId],
  );
  return rows.map(toTrip);
}

/**
 * Die Reisen, die diese Person sieht (req-023): die von ihr gefuehrten in
 * jedem Zustand und die freigegebenen, denen sie zugeordnet ist. Eine Reise
 * „In Planung“ erscheint bei den Mitreisenden nicht — der Reiseleiter gibt
 * sie frei, wenn sie so weit ist.
 *
 * Reisen, denen die Person gar nicht zugeordnet ist, bleiben aussen vor
 * (siehe delivery/security.md, Zugriffskreis).
 */
export async function listTripsForParticipant(
  db: Queryable,
  accountId: string,
  participantId: string,
): Promise<Trip[]> {
  const { rows } = await db.query<TripRow>(
    `select t.id, t.title, t.start_date, t.end_date, t.main_place_name,
            t.main_place_lat, t.main_place_lng, t.state
     from trip t
     join trip_participant tp
       on tp.trip_id = t.id and tp.participant_id = $2
     where t.account_id = $1
       and (tp.role = 'reiseleiter' or t.state = 'freigegeben')
     order by t.start_date asc`,
    [accountId, participantId],
  );
  return rows.map(toTrip);
}

/**
 * Die Reisen, die diese Sitzung sieht. Im eigenen Account entscheidet die
 * Zuordnung darueber (req-023).
 *
 * Arbeitet der Gesamt-Admin gerade in einem fremden Account, sieht er
 * dessen Reisen samt und sonders (req-025): er ist dort keiner Reise
 * zugeordnet und saehe sonst nichts -- gemeint ist aber, dass er dort mit
 * denselben Rechten arbeitet wie dessen Personen. Es bleibt bei genau einem
 * Account: gefiltert wird nach dem, in dem er sich gerade befindet.
 */
export function listTripsForSession(
  db: Queryable,
  session: Session,
): Promise<Trip[]> {
  return session.actingAccount
    ? listTrips(db, session.accountId)
    : listTripsForParticipant(db, session.accountId, session.participant.id);
}

/**
 * Ob die Reise zum Account gehoert — jeder schreibende Zugriff prueft das.
 * Der Account stammt dabei immer aus der Anmeldung, nie aus der Anfrage
 * (req-024); geprueft wird damit, ob die angemeldete Person die Reise
 * ueberhaupt anfassen darf.
 */
export async function tripBelongsToAccount(
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
 * Legt eine neue Reise im Account an (siehe req-017). Sie steht auf "In
 * Planung" (req-022) -- der Zustand wird ausdruecklich mitgeschrieben, nicht
 * dem Vorgabewert der Spalte ueberlassen.
 */
export async function createTrip(
  db: Queryable,
  accountId: string,
  input: TripInput,
): Promise<Trip> {
  const id = randomUUID();
  await db.query(
    `insert into trip (id, account_id, title, start_date, end_date,
                       main_place_name, main_place_lat, main_place_lng, state)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      accountId,
      input.title,
      input.startDate,
      input.endDate,
      input.mainPlace.name,
      input.mainPlace.lat,
      input.mainPlace.lng,
      DEFAULT_TRIP_STATE,
    ],
  );
  return {
    id,
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    mainPlace: input.mainPlace,
    state: DEFAULT_TRIP_STATE,
  };
}

/**
 * Korrigiert Titel, Zeitraum und Hauptort einer Reise (siehe req-017).
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function updateTrip(
  db: Queryable,
  accountId: string,
  tripId: string,
  input: TripInput,
): Promise<Trip | null> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return null;

  // Der Zustand bleibt, wie er ist: das Formular aendert Titel, Zeitraum und
  // Hauptort -- gesetzt wird er im Aufklappmenue am Reisenamen (req-022).
  const { rows } = await db.query<{ state: TripState }>(
    `update trip
     set title = $3, start_date = $4, end_date = $5,
         main_place_name = $6, main_place_lat = $7, main_place_lng = $8
     where id = $1 and account_id = $2
     returning state`,
    [
      tripId,
      accountId,
      input.title,
      input.startDate,
      input.endDate,
      input.mainPlace.name,
      input.mainPlace.lat,
      input.mainPlace.lng,
    ],
  );
  return {
    id: tripId,
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    mainPlace: input.mainPlace,
    state: rows[0].state,
  };
}

/**
 * Setzt den Zustand einer Reise (req-022). Er laesst sich jederzeit in beide
 * Richtungen wechseln -- eine Freigabe zurueckgenommen, eine abgeschlossene
 * Reise wieder geoeffnet.
 *
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function setTripState(
  db: Queryable,
  accountId: string,
  tripId: string,
  state: TripState,
): Promise<Trip | null> {
  const { rows } = await db.query<TripRow>(
    `update trip
     set state = $3
     where id = $1 and account_id = $2
     returning id, title, start_date, end_date,
               main_place_name, main_place_lat, main_place_lng, state`,
    [tripId, accountId, state],
  );
  if (rows.length === 0) return null;
  return toTrip(rows[0]);
}

/**
 * Loescht eine Reise samt aller daran haengenden Daten (siehe req-017,
 * Constraints: keine verwaisten Daten). Die Reihenfolge folgt den
 * Fremdschluesseln: erst was auf Programmpunkte und POIs zeigt, dann diese
 * selbst, zuletzt die Reise.
 *
 * Liefert false, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function deleteTrip(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<boolean> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return false;

  await db.query(`delete from activity_option_selection where trip_id = $1`, [
    tripId,
  ]);
  await db.query(`delete from transfer where trip_id = $1`, [tripId]);
  await db.query(`delete from activity where trip_id = $1`, [tripId]);
  await db.query(`delete from poi where trip_id = $1`, [tripId]);
  await db.query(
    `delete from search_area_point
     where search_area_id in (select id from search_area where trip_id = $1)`,
    [tripId],
  );
  await db.query(`delete from search_area where trip_id = $1`, [tripId]);
  // Mit der Reise endet auch, wer bei ihr mitgefahren waere (req-021); die
  // Personen selbst bleiben am Account.
  await db.query(`delete from trip_participant where trip_id = $1`, [tripId]);
  await db.query(`delete from trip where id = $1 and account_id = $2`, [
    tripId,
    accountId,
  ]);
  return true;
}
