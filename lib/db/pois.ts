import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import {
  listPhotoFileNamesOfPoi,
  listPhotosOfPoi,
  listPoiPhotos,
} from "./poi-photos";
import type {
  Poi,
  PoiBuchung,
  PoiStatus,
  PoiType,
  PoiValues,
} from "../pois/types";
import type { PoiDraft } from "../pois/ai-search";
import {
  changedPoiFields,
  ohneGefuellteFelder,
  parseManualFields,
  serializeManualFields,
  withManualFields,
  type ManualPoiField,
  type PoiFieldValues,
} from "../pois/manual-fields";
import type { PoiGoogleQuelle } from "../pois/google-ort";

/**
 * Woher die Werte eines gespeicherten Formulars stammen (req-048). Beides
 * ist freiwillig: wer das Suchfeld gar nicht benutzt, schickt nichts davon.
 */
export interface PoiHerkunft {
  /**
   * Was das Suchfeld gefuellt hat. Es gilt nicht als von Hand geaendert —
   * ein spaeteres Auffrischen aus Google darf es ersetzen (req-035).
   */
  autoFilled?: readonly ManualPoiField[];
  /** Der bei Google nachgeschlagene Ort, aus dem gefuellt wurde. */
  google?: PoiGoogleQuelle | null;
}

interface PoiRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  number: number;
  name: string;
  ort: string;
  type: PoiType;
  lat: number;
  lng: number;
  status: PoiStatus;
  web: string | null;
  short_text: string | null;
  duration_min: number | null;
  kosten_cent: number | null;
  buchung: PoiBuchung;
  long_text: string | null;
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  google_place_id: string | null;
  manual_fields: string;
  bewertung: number | null;
  bewertung_anzahl: number | null;
  ki_begruendung: string | null;
}

const POI_COLUMNS = `id, trip_id, number, name, ort, type, lat, lng,
                     status, web, short_text, long_text, address, phone,
                     opening_hours, google_place_id, manual_fields,
                     bewertung, bewertung_anzahl, ki_begruendung, duration_min,
                     kosten_cent, buchung`;

/** Dieselben Spalten, qualifiziert fuer die Abfragen mit Verknuepfung. */
const POI_COLUMNS_JOINED = `p.id, p.trip_id, p.number, p.name, p.ort, p.type, p.lat, p.lng,
                            p.status, p.web, p.short_text, p.long_text, p.address, p.phone,
                            p.opening_hours, p.google_place_id, p.manual_fields,
                            p.bewertung, p.bewertung_anzahl, p.ki_begruendung, p.duration_min,
                            p.kosten_cent, p.buchung`;

/** Die Oeffnungszeiten liegen als Text ab, eine Zeile je Wochentag (req-026). */
function toOpeningHours(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const lines = raw.split("\n").filter((line) => line.length > 0);
  return lines.length > 0 ? lines : undefined;
}

function toPoi(row: PoiRow): Poi {
  return {
    id: row.id,
    tripId: row.trip_id,
    number: row.number,
    name: row.name,
    ort: row.ort,
    type: row.type,
    position: { lat: row.lat, lng: row.lng },
    status: row.status,
    web: row.web ?? undefined,
    shortText: row.short_text ?? undefined,
    longText: row.long_text ?? undefined,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    openingHours: toOpeningHours(row.opening_hours),
    googlePlaceId: row.google_place_id ?? undefined,
    // Die Angaben aus der KI-Suche (req-057); ein POI von Hand traegt sie
    // nicht.
    bewertung: row.bewertung ?? undefined,
    bewertungAnzahl: row.bewertung_anzahl ?? undefined,
    kiBegruendung: row.ki_begruendung ?? undefined,
    durationMinutes: row.duration_min ?? undefined,
    // Die Kosten je Person (req-061) -- nicht eingetragen heisst: keine
    // Angabe, nicht "kostet nichts".
    kostenCent: row.kosten_cent ?? undefined,
    // Ob der Ort noch gebucht werden muss (req-061) -- jeder POI traegt
    // einen Buchungsstatus, vorgegeben ist "Nicht noetig".
    buchung: row.buchung,
    photos: [],
  };
}

/**
 * Alle POIs aller Reisen des Accounts (Mandantentrennung ueber trip),
 * jeweils mit ihren Fotos (req-026).
 */
export async function listPois(
  db: Queryable,
  accountId: string,
): Promise<Poi[]> {
  const { rows } = await db.query<PoiRow>(
    `select ${POI_COLUMNS_JOINED}
     from poi p
     join trip t on t.id = p.trip_id
     where t.account_id = $1
     order by p.name asc`,
    [accountId],
  );
  const photos = await listPoiPhotos(db, accountId);
  return rows.map((row) => ({
    ...toPoi(row),
    photos: photos.get(row.id) ?? [],
  }));
}

/**
 * Setzt den Status eines POI (siehe req-010, Constraints: nur der
 * Reiseleiter). Der Account stammt aus der Anmeldung, die POI-Kennung aus
 * der Anfrage — deshalb wird mitgeprueft, ob der POI ueberhaupt zu einer
 * Reise dieses Accounts gehoert (req-024).
 *
 * Liefert false, wenn es im Account keinen solchen POI gibt.
 */
export async function setPoiStatus(
  db: Queryable,
  accountId: string,
  poiId: string,
  status: PoiStatus,
): Promise<boolean> {
  const { rows } = await db.query(
    `update poi
     set status = $3
     where id = $1
       and trip_id in (select id from trip where account_id = $2)
     returning id`,
    [poiId, accountId, status],
  );
  return rows.length > 0;
}

/**
 * Setzt die Kosten je Person eines POI (req-061), null nimmt sie ihm wieder.
 * Bedient wird das im POI-Formular und seit req-062 auch in der Tabelle der
 * Kostenplanung -- eine Wahrheit, an zwei Stellen bedienbar; deshalb steht
 * der Betrag am POI und nicht in der Kostenzeile.
 *
 * Liefert den geaenderten POI, oder null, wenn es im Account keinen solchen
 * gibt (req-024).
 */
export async function setPoiKostenCent(
  db: Queryable,
  accountId: string,
  poiId: string,
  kostenCent: number | null,
): Promise<Poi | null> {
  return setPoiFeld(db, accountId, poiId, "kosten_cent", kostenCent);
}

/**
 * Setzt den Buchungsstatus eines POI (req-061) -- ebenfalls aus dem Formular
 * wie aus der Kostenplanung (req-062) bedienbar.
 */
export async function setPoiBuchung(
  db: Queryable,
  accountId: string,
  poiId: string,
  buchung: PoiBuchung,
): Promise<Poi | null> {
  return setPoiFeld(db, accountId, poiId, "buchung", buchung);
}

/**
 * Setzt genau eine Spalte eines POI des Accounts. Der Spaltenname kommt
 * ausschliesslich von den beiden Funktionen darueber und nie aus einer
 * Anfrage -- er steht als fester Wert im Quelltext.
 */
async function setPoiFeld(
  db: Queryable,
  accountId: string,
  poiId: string,
  spalte: "kosten_cent" | "buchung",
  wert: number | string | null,
): Promise<Poi | null> {
  const { rows } = await db.query<PoiRow>(
    `update poi
     set ${spalte} = $3
     where id = $1
       and trip_id in (select id from trip where account_id = $2)
     returning ${POI_COLUMNS}`,
    [poiId, accountId, wert],
  );
  if (!rows[0]) return null;

  const poi = toPoi(rows[0]);
  // Ohne seine Fotos kaeme der POI in der Liste ohne Bild zurueck (bug-020):
  // der Aufrufer ersetzt damit den Stand in der Oberflaeche.
  poi.photos = await listPhotosOfPoi(db, poi.id);
  return poi;
}

/**
 * Legt neue POIs einer Reise an, mit fortlaufender Nummer ab der naechsten
 * freien (siehe req-013) und Status "Weiß noch nicht" (siehe req-014).
 *
 * Seit req-057 stammen die Entwuerfe aus Google Places und bringen ihre
 * Angaben mit: Beschreibung, Anschrift, Bewertung und den Satz, warum die KI
 * den Ort vorschlaegt.
 */
export async function createPois(
  db: Queryable,
  tripId: string,
  drafts: PoiDraft[],
): Promise<Poi[]> {
  let nextNumber = await naechsteNummer(db, tripId);

  const created: Poi[] = [];
  for (const draft of drafts) {
    const id = randomUUID();
    const openingHours = draft.openingHours?.join("\n") || null;
    await db.query(
      `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status,
                        web, short_text, long_text, address, phone,
                        opening_hours, google_place_id, bewertung,
                        bewertung_anzahl, ki_begruendung)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'weiss_nicht', $9, $10, $11,
               $12, $13, $14, $15, $16, $17, $18)`,
      [
        id,
        tripId,
        nextNumber,
        draft.name,
        draft.ort,
        draft.type,
        draft.position.lat,
        draft.position.lng,
        draft.web ?? null,
        draft.shortText ?? null,
        draft.longText ?? null,
        draft.address ?? null,
        draft.phone ?? null,
        openingHours,
        draft.googlePlaceId ?? null,
        draft.bewertung ?? null,
        draft.bewertungAnzahl ?? null,
        draft.kiBegruendung ?? null,
      ],
    );
    created.push({
      id,
      tripId,
      number: nextNumber,
      name: draft.name,
      ort: draft.ort,
      type: draft.type,
      position: draft.position,
      status: "weiss_nicht",
      web: draft.web,
      shortText: draft.shortText,
      longText: draft.longText,
      address: draft.address,
      phone: draft.phone,
      openingHours: draft.openingHours,
      googlePlaceId: draft.googlePlaceId,
      bewertung: draft.bewertung,
      bewertungAnzahl: draft.bewertungAnzahl,
      kiBegruendung: draft.kiBegruendung,
      photos: [],
    });
    nextNumber++;
  }
  return created;
}

async function naechsteNummer(db: Queryable, tripId: string): Promise<number> {
  const { rows } = await db.query<{ max: number | null }>(
    `select max(number) as max from poi where trip_id = $1`,
    [tripId],
  );
  return (rows[0]?.max ?? 0) + 1;
}

function toFieldValues(row: PoiRow): PoiFieldValues {
  return {
    name: row.name,
    ort: row.ort,
    type: row.type,
    shortText: row.short_text,
    longText: row.long_text,
    lat: row.lat,
    lng: row.lng,
    web: row.web,
    address: row.address,
    phone: row.phone,
    openingHours: row.opening_hours,
  };
}

/**
 * `bisher` ist der Ort, der stehen bleibt, wenn sich keiner ableiten liess
 * (req-041) -- bei einem neuen POI ist das der leere Ort.
 */
function valuesToFields(values: PoiValues, bisher: string): PoiFieldValues {
  const openingHours = values.openingHours?.join("\n") ?? null;
  return {
    name: values.name,
    ort: values.ort ?? bisher,
    type: values.type,
    shortText: values.shortText,
    longText: values.longText,
    lat: values.position.lat,
    lng: values.position.lng,
    web: values.web,
    address: values.address,
    phone: values.phone,
    openingHours: openingHours && openingHours.length > 0 ? openingHours : null,
  };
}

/**
 * Legt einen POI von Hand an (req-035): naechste freie Nummer (req-013) und
 * der uebergebene Status -- das Formular beginnt bei "Weiß noch nicht".
 *
 * Als von Hand geaendert gilt zunaechst nichts: ein spaeter eingefuegter
 * Google-Maps-Link darf einen selbst erfassten Ort noch ergaenzen. Erst was
 * danach von Hand geaendert wird, ist vor dem Import geschuetzt.
 *
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert (req-024).
 */
export async function createPoi(
  db: Queryable,
  accountId: string,
  tripId: string,
  values: PoiValues,
  herkunft: PoiHerkunft = {},
): Promise<Poi | null> {
  if (!(await tripGehoertZuAccount(db, accountId, tripId))) return null;

  // Ohne abgeleiteten Ort bleibt er beim neuen POI leer; seine Zeile in der
  // POI-Liste zeigt dann keine Ortsangabe (req-041).
  const felder = valuesToFields(values, "");
  // Wurde das Formular aus einem Google-Maps-Link gefuellt, ist der neue POI
  // derselbe Ort wie dort (req-048) -- Kennung und Bewertung gehoeren dazu.
  const google = herkunft.google ?? null;
  const placeId = google
    ? await freieGooglePlaceId(db, tripId, google.placeId)
    : null;
  const id = randomUUID();
  const number = await naechsteNummer(db, tripId);
  const { rows } = await db.query<PoiRow>(
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status,
                      web, short_text, long_text, address, phone, opening_hours,
                      google_place_id, bewertung, bewertung_anzahl, duration_min,
                      kosten_cent, buchung)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20, $21)
     returning ${POI_COLUMNS}`,
    [
      id,
      tripId,
      number,
      felder.name,
      felder.ort,
      felder.type,
      felder.lat,
      felder.lng,
      values.status,
      felder.web,
      felder.shortText,
      felder.longText,
      felder.address,
      felder.phone,
      felder.openingHours,
      placeId,
      google?.bewertung ?? null,
      google?.bewertungAnzahl ?? null,
      values.durationMinutes,
      values.kostenCent,
      values.buchung,
    ],
  );
  return toPoi(rows[0]);
}

/** Der POI, aber nur wenn er zu einer Reise dieses Accounts gehoert (req-024). */
async function poiRow(
  db: Queryable,
  accountId: string,
  poiId: string,
): Promise<PoiRow | null> {
  const { rows } = await db.query<PoiRow>(
    `select ${POI_COLUMNS_JOINED}
     from poi p
     join trip t on t.id = p.trip_id
     where p.id = $1 and t.account_id = $2`,
    [poiId, accountId],
  );
  return rows[0] ?? null;
}

/**
 * Ein einzelner POI des Accounts (req-039) -- was das Verplanen braucht:
 * Name, Position und Typ des POI werden zum Programmpunkt.
 *
 * Liefert null, wenn es im Account keinen solchen POI gibt (req-024).
 */
export async function findPoi(
  db: Queryable,
  accountId: string,
  poiId: string,
): Promise<Poi | null> {
  const row = await poiRow(db, accountId, poiId);
  return row ? toPoi(row) : null;
}

/**
 * Aendert die Angaben eines POI (req-035). Die Nummer bleibt fest -- ueber
 * sie wird in der Gruppe und auf der Karte gesprochen (req-013).
 *
 * Jede tatsaechlich geaenderte Angabe wird als "von Hand geaendert"
 * vermerkt (req-035); was unveraendert bleibt, bleibt auch unvermerkt.
 *
 * Was das Suchfeld des Formulars gefuellt hat, gilt dabei nicht als von Hand
 * geaendert (req-048): es kommt aus einer Quelle, nicht von mir, und darf
 * beim Auffrischen daraus wieder ersetzt werden. Vermerkt bleibt so nur,
 * was ich selbst getippt habe.
 *
 * Liefert null, wenn es im Account keinen solchen POI gibt.
 */
export async function updatePoi(
  db: Queryable,
  accountId: string,
  poiId: string,
  values: PoiValues,
  herkunft: PoiHerkunft = {},
): Promise<Poi | null> {
  const vorhanden = await poiRow(db, accountId, poiId);
  if (!vorhanden) return null;

  // Liess sich kein Ort ableiten, bleibt der gespeicherte stehen (req-041).
  const neu = valuesToFields(values, vorhanden.ort);
  const manuell = withManualFields(
    parseManualFields(vorhanden.manual_fields),
    ohneGefuellteFelder(
      changedPoiFields(toFieldValues(vorhanden), neu),
      herkunft.autoFilled ?? [],
    ),
  );
  // Aus einem Google-Maps-Link gefuellt heisst: dieser POI ist jener Ort
  // (req-048). Ohne Link bleibt die bisherige Kennung stehen.
  const google = herkunft.google ?? null;
  const placeId = google
    ? await freieGooglePlaceId(
        db,
        vorhanden.trip_id,
        google.placeId,
        vorhanden.id,
      )
    : null;

  const { rows } = await db.query<PoiRow>(
    `update poi
     set name = $2, ort = $3, type = $4, lat = $5, lng = $6, status = $7,
         web = $8, short_text = $9, long_text = $10, address = $11,
         phone = $12, opening_hours = $13, manual_fields = $14,
         google_place_id = coalesce($15, google_place_id),
         bewertung = coalesce($16, bewertung),
         bewertung_anzahl = coalesce($17, bewertung_anzahl),
         duration_min = $18, kosten_cent = $19, buchung = $20
     where id = $1
     returning ${POI_COLUMNS}`,
    [
      poiId,
      neu.name,
      neu.ort,
      neu.type,
      neu.lat,
      neu.lng,
      values.status,
      neu.web,
      neu.shortText,
      neu.longText,
      neu.address,
      neu.phone,
      neu.openingHours,
      serializeManualFields(manuell),
      placeId,
      google?.bewertung ?? null,
      google?.bewertungAnzahl ?? null,
      values.durationMinutes,
      values.kostenCent,
      values.buchung,
    ],
  );

  const poi = toPoi(rows[0]);
  poi.photos = await listPhotosOfPoi(db, poi.id);
  return poi;
}

/**
 * Entfernt einen POI samt seinen Fotos (req-035). Ein Programmpunkt, der aus
 * ihm entstanden ist, bleibt bestehen und verliert nur die Verknuepfung --
 * er hat eine feste Zeit im Plan, die nicht mit dem POI verschwindet.
 *
 * Liefert die Dateinamen der entfernten Fotos: der Aufrufer raeumt sie aus
 * der Bildablage, damit keine verwaisten Dateien zurueckbleiben (stack.md).
 * Liefert null, wenn es im Account keinen solchen POI gibt.
 */
export async function deletePoi(
  db: Queryable,
  accountId: string,
  poiId: string,
): Promise<{ poi: Poi; removedFileNames: string[] } | null> {
  const vorhanden = await poiRow(db, accountId, poiId);
  if (!vorhanden) return null;

  const removedFileNames = await listPhotoFileNamesOfPoi(db, poiId);

  // Der Programmpunkt bleibt, seine Verknuepfung loest sich (req-035).
  await db.query(`update activity set poi_id = null where poi_id = $1`, [
    poiId,
  ]);
  // Dasselbe gilt fuer ein Dokument, das auf den POI zeigte (req-034).
  await db.query(`update document set poi_id = null where poi_id = $1`, [
    poiId,
  ]);
  await db.query(`delete from poi_photo where poi_id = $1`, [poiId]);
  await db.query(`delete from poi where id = $1`, [poiId]);

  return { poi: toPoi(vorhanden), removedFileNames };
}

/**
 * Entfernt mehrere in der Liste angekreuzte POIs auf einmal (req-057).
 * Jeder einzelne geht denselben Weg wie beim Entfernen von Hand (req-035):
 * seine Fotodatensaetze verschwinden mit ihm, seine Dateien raeumt der
 * Aufrufer aus der Ablage.
 *
 * POIs, die es im Account nicht gibt, werden stillschweigend uebergangen —
 * ein bereits entfernter POI darf das Entfernen der uebrigen nicht
 * verhindern. Geliefert wird, was tatsaechlich verschwunden ist.
 */
export async function deletePois(
  db: Queryable,
  accountId: string,
  poiIds: string[],
): Promise<{ pois: Poi[]; removedFileNames: string[] }> {
  const pois: Poi[] = [];
  const removedFileNames: string[] = [];

  for (const poiId of poiIds) {
    const entfernt = await deletePoi(db, accountId, poiId);
    if (!entfernt) continue;
    pois.push(entfernt.poi);
    removedFileNames.push(...entfernt.removedFileNames);
  }

  return { pois, removedFileNames };
}

/**
 * Die Kennung des Google-Ortes, sofern sie in dieser Reise noch frei ist
 * (req-048). Je Reise darf es dieselbe nur einmal geben
 * (`poi_trip_google_place_id_key`): steht der Ort dort schon, entsteht der
 * POI trotzdem — mit allen uebernommenen Angaben, aber ohne die Kennung.
 * Wer denselben Ort ein zweites Mal anlegt, will ihn; nur "derselbe Ort bei
 * Google" ist er dann nicht mehr.
 */
async function freieGooglePlaceId(
  db: Queryable,
  tripId: string,
  placeId: string,
  ausser?: string,
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `select id from poi where trip_id = $1 and google_place_id = $2`,
    [tripId, placeId],
  );
  const belegt = rows.some((row) => row.id !== ausser);
  return belegt ? null : placeId;
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
