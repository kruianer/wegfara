import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type {
  GespeicherteKostenzeile,
  KostenzeileAenderung,
} from "../kosten/types";
import type { PoiBuchung } from "../pois/types";

/**
 * Der Datenzugriff auf die Kostenplanung (req-062). Gespeichert wird nur,
 * was sich nicht aus Plan und POI ergibt: die von Hand gesetzte Anzahl, das
 * verknuepfte Dokument und -- bei Zeilen ohne POI -- Bezeichnung, Preis und
 * Buchungsstatus.
 *
 * Zu einem Programmpunkt entsteht die Zeile erst, wenn an ihr etwas zu
 * speichern ist: solange Preis und Buchungsstatz am POI stehen und die
 * Anzahl mit der Teilnehmerzahl nachzieht, gibt es nichts abzulegen.
 */

interface KostenzeileRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  activity_id: string | null;
  bezeichnung: string | null;
  preis_cent: number | null;
  buchung: PoiBuchung | null;
  anzahl: number | null;
  dokument_id: string | null;
}

const KOSTENZEILE_COLUMNS = `k.id, k.trip_id, k.activity_id, k.bezeichnung,
                             k.preis_cent, k.buchung, k.anzahl, k.dokument_id`;

function toKostenzeile(row: KostenzeileRow): GespeicherteKostenzeile {
  return {
    id: row.id,
    tripId: row.trip_id,
    activityId: row.activity_id,
    bezeichnung: row.bezeichnung,
    preisCent: row.preis_cent === null ? null : Number(row.preis_cent),
    buchung: row.buchung,
    anzahl: row.anzahl === null ? null : Number(row.anzahl),
    dokumentId: row.dokument_id,
  };
}

/** Alle gespeicherten Kostenzeilen aller Reisen des Accounts (req-062). */
export async function listKostenzeilen(
  db: Queryable,
  accountId: string,
): Promise<GespeicherteKostenzeile[]> {
  const { rows } = await db.query<KostenzeileRow>(
    `select ${KOSTENZEILE_COLUMNS}
     from kostenzeile k
     join trip t on t.id = k.trip_id
     where t.account_id = $1`,
    [accountId],
  );
  return rows.map(toKostenzeile);
}

async function readKostenzeile(
  db: Queryable,
  id: string,
): Promise<GespeicherteKostenzeile | null> {
  const { rows } = await db.query<KostenzeileRow>(
    `select ${KOSTENZEILE_COLUMNS} from kostenzeile k where k.id = $1`,
    [id],
  );
  return rows[0] ? toKostenzeile(rows[0]) : null;
}

/** Die Reise eines Programmpunkts, sofern beide zu diesem Account gehoeren. */
async function tripOfActivity(
  db: Queryable,
  accountId: string,
  activityId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ trip_id: string }>(
    `select a.trip_id
     from activity a
     join trip t on t.id = a.trip_id
     where a.id = $1 and t.account_id = $2`,
    [activityId, accountId],
  );
  return rows[0]?.trip_id ?? null;
}

/** Die Reise einer Kostenzeile, sofern beide zu diesem Account gehoeren. */
async function tripOfKostenzeile(
  db: Queryable,
  accountId: string,
  id: string,
): Promise<string | null> {
  const { rows } = await db.query<{ trip_id: string }>(
    `select k.trip_id
     from kostenzeile k
     join trip t on t.id = k.trip_id
     where k.id = $1 and t.account_id = $2`,
    [id, accountId],
  );
  return rows[0]?.trip_id ?? null;
}

/**
 * Ob das Dokument zu dieser Reise gehoert. Verknuepfbar sind nur Dokumente
 * derselben Reise (req-062, Constraints; wie bei req-034).
 */
async function dokumentInTrip(
  db: Queryable,
  tripId: string,
  dokumentId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select id from document where id = $1 and trip_id = $2`,
    [dokumentId, tripId],
  );
  return rows.length > 0;
}

const FELDER = {
  bezeichnung: "bezeichnung",
  preisCent: "preis_cent",
  buchung: "buchung",
  anzahl: "anzahl",
  dokumentId: "dokument_id",
} as const;

/**
 * Baut das `set` einer Aenderung. Die Spaltennamen stehen fest im Quelltext
 * (FELDER) -- aus der Anfrage kommt nur, welche davon gemeint sind.
 */
function setzung(aenderung: KostenzeileAenderung, ab: number) {
  const teile: string[] = [];
  const werte: (string | number | null)[] = [];
  for (const [feld, spalte] of Object.entries(FELDER)) {
    const wert = aenderung[feld as keyof KostenzeileAenderung];
    if (wert === undefined) continue;
    teile.push(`${spalte} = $${ab + werte.length}`);
    werte.push(wert);
  }
  return { teile, werte };
}

export type KostenzeileFailure = "unknown" | "notInTrip";

export type KostenzeileResult =
  | { ok: true; zeile: GespeicherteKostenzeile }
  | { ok: false; reason: KostenzeileFailure };

/**
 * Speichert eine Aenderung an der Zeile eines Programmpunkts (req-062) und
 * legt sie an, falls es sie noch nicht gibt. Je Programmpunkt gibt es
 * hoechstens eine.
 */
export async function saveKostenzeileZuProgrammpunkt(
  db: Queryable,
  accountId: string,
  activityId: string,
  aenderung: KostenzeileAenderung,
): Promise<KostenzeileResult> {
  const tripId = await tripOfActivity(db, accountId, activityId);
  if (!tripId) return { ok: false, reason: "unknown" };
  if (
    aenderung.dokumentId &&
    !(await dokumentInTrip(db, tripId, aenderung.dokumentId))
  ) {
    return { ok: false, reason: "notInTrip" };
  }

  const { rows } = await db.query<{ id: string }>(
    `select id from kostenzeile where activity_id = $1`,
    [activityId],
  );
  const vorhanden = rows[0]?.id;
  if (!vorhanden) {
    const id = randomUUID();
    await db.query(
      `insert into kostenzeile (id, trip_id, activity_id, bezeichnung,
                                preis_cent, buchung, anzahl, dokument_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        tripId,
        activityId,
        aenderung.bezeichnung ?? null,
        aenderung.preisCent ?? null,
        aenderung.buchung ?? null,
        aenderung.anzahl ?? null,
        aenderung.dokumentId ?? null,
      ],
    );
    const zeile = await readKostenzeile(db, id);
    return zeile ? { ok: true, zeile } : { ok: false, reason: "unknown" };
  }

  return aendere(db, vorhanden, aenderung);
}

/** Aendert eine bereits gespeicherte Zeile. */
async function aendere(
  db: Queryable,
  id: string,
  aenderung: KostenzeileAenderung,
): Promise<KostenzeileResult> {
  const { teile, werte } = setzung(aenderung, 2);
  if (teile.length > 0) {
    await db.query(`update kostenzeile set ${teile.join(", ")} where id = $1`, [
      id,
      ...werte,
    ]);
  }
  const zeile = await readKostenzeile(db, id);
  return zeile ? { ok: true, zeile } : { ok: false, reason: "unknown" };
}

/** Aendert eine manuelle Zeile (req-062). */
export async function updateKostenzeile(
  db: Queryable,
  accountId: string,
  id: string,
  aenderung: KostenzeileAenderung,
): Promise<KostenzeileResult> {
  const tripId = await tripOfKostenzeile(db, accountId, id);
  if (!tripId) return { ok: false, reason: "unknown" };
  if (
    aenderung.dokumentId &&
    !(await dokumentInTrip(db, tripId, aenderung.dokumentId))
  ) {
    return { ok: false, reason: "notInTrip" };
  }
  return aendere(db, id, aenderung);
}

/**
 * Legt eine manuelle Zeile an (req-062) -- fuer alles ohne Programmpunkt:
 * Maut, Parkgebuehren, Sprit.
 */
export async function createKostenzeile(
  db: Queryable,
  accountId: string,
  tripId: string,
  felder: {
    bezeichnung: string;
    preisCent: number | null;
    buchung: PoiBuchung;
    anzahl: number | null;
    dokumentId: string | null;
  },
): Promise<KostenzeileResult> {
  const { rows } = await db.query(
    `select id from trip where id = $1 and account_id = $2`,
    [tripId, accountId],
  );
  if (rows.length === 0) return { ok: false, reason: "unknown" };
  if (
    felder.dokumentId &&
    !(await dokumentInTrip(db, tripId, felder.dokumentId))
  ) {
    return { ok: false, reason: "notInTrip" };
  }

  const id = randomUUID();
  await db.query(
    `insert into kostenzeile (id, trip_id, activity_id, bezeichnung,
                              preis_cent, buchung, anzahl, dokument_id)
     values ($1, $2, null, $3, $4, $5, $6, $7)`,
    [
      id,
      tripId,
      felder.bezeichnung,
      felder.preisCent,
      felder.buchung,
      felder.anzahl,
      felder.dokumentId,
    ],
  );
  const zeile = await readKostenzeile(db, id);
  return zeile ? { ok: true, zeile } : { ok: false, reason: "unknown" };
}

/**
 * Entfernt eine manuelle Zeile (req-062). Eine Zeile aus dem Zeitstrahl
 * laesst sich nicht loeschen -- sie kommt aus dem Plan und verschwindet mit
 * ihrem Programmpunkt. Liefert false, wenn es im Account keine solche
 * manuelle Zeile gibt.
 */
export async function deleteKostenzeile(
  db: Queryable,
  accountId: string,
  id: string,
): Promise<boolean> {
  if (!(await tripOfKostenzeile(db, accountId, id))) return false;

  const { rows } = await db.query<{ id: string }>(
    `delete from kostenzeile
     where id = $1 and activity_id is null
     returning id`,
    [id],
  );
  return rows.length > 0;
}

/**
 * Entfernt die Kostenzeilen einer Reise -- gebraucht, wenn die Reise selbst
 * geloescht wird (req-017).
 */
export async function deleteKostenzeilenOfTrip(
  db: Queryable,
  tripId: string,
): Promise<void> {
  await db.query(`delete from kostenzeile where trip_id = $1`, [tripId]);
}
