import type { Queryable } from "./queryable";
import type { TagesUeberschrift } from "../druck/ueberschriften";

/**
 * Die Ueberschriften der Reisetage fuer Seite 2 des gedruckten Plans
 * (req-103). Die Mandantentrennung laeuft ueber die Reise (req-024).
 *
 * Eine von Hand geschriebene Ueberschrift (`von_hand`) ruehrt das Erzeugen
 * durch die KI nicht mehr an.
 */

interface UeberschriftRow extends Record<string, unknown> {
  trip_id: string;
  datum: unknown;
  text: string;
  von_hand: boolean;
}

function isoDatum(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function toUeberschrift(row: UeberschriftRow): TagesUeberschrift {
  return {
    tripId: row.trip_id,
    datum: isoDatum(row.datum),
    text: row.text,
    vonHand: row.von_hand,
  };
}

async function tripGehoertZuAccount(
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
 * Die gespeicherten Ueberschriften -- aller Reisen des Accounts oder, mit
 * `tripId`, einer Reise.
 */
export async function listTagesUeberschriften(
  db: Queryable,
  accountId: string,
  tripId?: string,
): Promise<TagesUeberschrift[]> {
  const { rows } = await db.query<UeberschriftRow>(
    `select u.trip_id, u.datum, u.text, u.von_hand
     from tages_ueberschrift u
     join trip t on t.id = u.trip_id
     where t.account_id = $1${tripId === undefined ? "" : " and u.trip_id = $2"}
     order by u.datum asc`,
    tripId === undefined ? [accountId] : [accountId, tripId],
  );
  return rows.map(toUeberschrift);
}

async function schreibe(
  db: Queryable,
  tripId: string,
  datum: string,
  text: string,
  vonHand: boolean,
  now: Date,
): Promise<void> {
  await db.query(
    `delete from tages_ueberschrift where trip_id = $1 and datum = $2`,
    [tripId, datum],
  );
  await db.query(
    `insert into tages_ueberschrift (trip_id, datum, text, von_hand, updated_at)
     values ($1, $2, $3, $4, $5)`,
    [tripId, datum, text, vonHand, now],
  );
}

/**
 * Speichert, was die KI vorgeschlagen hat. Eine von Hand geschriebene
 * Ueberschrift bleibt stehen -- die KI ruehrt sie nicht mehr an (req-103).
 *
 * Liefert die Ueberschriften der Reise danach, oder null, wenn die Reise
 * nicht zum Account gehoert.
 */
export async function speichereKiUeberschriften(
  db: Queryable,
  accountId: string,
  tripId: string,
  vorschlaege: { datum: string; text: string }[],
  now: Date,
): Promise<TagesUeberschrift[] | null> {
  if (!(await tripGehoertZuAccount(db, accountId, tripId))) return null;

  const vonHand = new Set(
    (await listTagesUeberschriften(db, accountId, tripId))
      .filter((u) => u.vonHand)
      .map((u) => u.datum),
  );
  for (const vorschlag of vorschlaege) {
    if (vonHand.has(vorschlag.datum)) continue;
    await schreibe(db, tripId, vorschlag.datum, vorschlag.text, false, now);
  }
  return listTagesUeberschriften(db, accountId, tripId);
}

/**
 * Setzt eine Ueberschrift von Hand -- sie ist danach als solche
 * gekennzeichnet. Ein leerer Text nimmt sie weg: dann stehen wieder die Orte
 * des Tages da, und die KI darf den Tag beim naechsten Mal wieder fuellen.
 *
 * Liefert die Ueberschriften der Reise danach, oder null, wenn die Reise
 * nicht zum Account gehoert.
 */
export async function setzeHandUeberschrift(
  db: Queryable,
  accountId: string,
  tripId: string,
  datum: string,
  text: string,
  now: Date,
): Promise<TagesUeberschrift[] | null> {
  if (!(await tripGehoertZuAccount(db, accountId, tripId))) return null;

  if (text.length === 0) {
    await db.query(
      `delete from tages_ueberschrift where trip_id = $1 and datum = $2`,
      [tripId, datum],
    );
  } else {
    await schreibe(db, tripId, datum, text, true, now);
  }
  return listTagesUeberschriften(db, accountId, tripId);
}
