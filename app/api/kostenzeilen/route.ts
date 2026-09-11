import { getPool } from "@/lib/db/pool";
import { findActivity } from "@/lib/db/activities";
import {
  createKostenzeile,
  deleteKostenzeile,
  saveKostenzeileZuProgrammpunkt,
  updateKostenzeile,
  type KostenzeileFailure,
} from "@/lib/db/kostenzeilen";
import { setPoiBuchung, setPoiKostenCent } from "@/lib/db/pois";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { isPoiBuchung, VORGEGEBENE_BUCHUNG } from "@/lib/pois/buchung";
import { parseKosten } from "@/lib/pois/kosten";
import { parseAnzahl } from "@/lib/kosten/anzahl";
import { bezeichnungProblem } from "@/lib/kosten/validate";
import type { Poi } from "@/lib/pois/types";
import type {
  GespeicherteKostenzeile,
  KostenzeileAenderung,
} from "@/lib/kosten/types";

/**
 * Die Kostenplanung einer Reise (req-062): Preis je Person und
 * Buchungsstatus einer Zeile aendern.
 *
 * Wo eine Aenderung landet, entscheidet die Zeile und nicht der Aufrufer:
 * Steht hinter ihr ein POI, gehen Preis und Buchungsstatus an den POI
 * (req-061) -- es gibt eine Wahrheit, an zwei Stellen bedienbar. Hat der
 * Programmpunkt keinen POI (etwa der Ausgangspunkt der Anreise, req-018),
 * gibt es nichts, woran der Preis sonst stehen koennte: dann traegt ihn die
 * Kostenzeile selbst.
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024):
 * Programmpunkte und Zeilen anderer Accounts existieren fuer diese Sitzung
 * nicht.
 */

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

/** 404 fuer Unbekanntes, 409 fuer eine Verknuepfung ausserhalb der Reise. */
function failure(reason: KostenzeileFailure) {
  return reason === "notInTrip"
    ? Response.json({ error: "notInTrip" }, { status: 409 })
    : Response.json({ error: "unknown" }, { status: 404 });
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Der eingetippte Preis als Cent. Gelesen wird er wie am POI (req-061):
 * „12,50" mit Komma oder Punkt, leer heisst "nicht eingetragen". An einem
 * Geldbetrag wird nichts geraten -- was sich nicht lesen laesst, wird
 * abgewiesen.
 */
function preisOf(value: unknown): number | null | "ungueltig" | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return "ungueltig";
  return parseKosten(value);
}

/**
 * Die eingetippte Anzahl. Leer heisst: die Zeile zieht wieder mit der
 * Teilnehmerzahl nach (req-062).
 */
function anzahlOf(value: unknown): number | null | "ungueltig" | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return parseAnzahl(String(value));
  if (typeof value !== "string") return "ungueltig";
  return parseAnzahl(value);
}

/**
 * Legt eine manuelle Zeile an (req-062) -- fuer alles, was kein
 * Programmpunkt ist: Maut, Parkgebuehren, Sprit. Anlegen ist ein Vorgang, bei
 * dem der Nutzer eine Bestaetigung erwartet: es wird sofort geschrieben
 * (siehe delivery/stack.md, Conventions).
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const tripId = textOf(body.tripId);
  const bezeichnung = textOf(body.bezeichnung);
  if (!tripId || bezeichnungProblem(bezeichnung)) return invalidBody();

  const preis = preisOf(body.preis);
  if (preis === "ungueltig") return invalidBody();
  const anzahl = anzahlOf(body.anzahl);
  if (anzahl === "ungueltig") return invalidBody();
  const buchung =
    body.buchung === undefined ? VORGEGEBENE_BUCHUNG : body.buchung;
  if (!isPoiBuchung(buchung)) return invalidBody();

  const ergebnis = await createKostenzeile(
    getPool(),
    session.accountId,
    tripId,
    {
      bezeichnung,
      preisCent: preis ?? null,
      buchung,
      anzahl: anzahl ?? null,
      dokumentId: null,
    },
    new Date(),
  );
  if (!ergebnis.ok) return failure(ergebnis.reason);
  return Response.json({ zeile: ergebnis.zeile, poi: null });
}

/**
 * Entfernt eine manuelle Zeile (req-062). Eine Zeile aus dem Zeitstrahl gibt
 * es hier nicht zu loeschen: sie kommt aus dem Plan und verschwindet mit
 * ihrem Programmpunkt.
 */
export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  const id = textOf(body?.id);
  if (!id) return invalidBody();

  const entfernt = await deleteKostenzeile(getPool(), session.accountId, id);
  if (!entfernt) return failure("unknown");
  return Response.json({ status: "ok" });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const preis = preisOf(body.preis);
  if (preis === "ungueltig") return invalidBody();
  const anzahl = anzahlOf(body.anzahl);
  if (anzahl === "ungueltig") return invalidBody();
  const buchung = body.buchung === undefined ? undefined : body.buchung;
  if (buchung !== undefined && !isPoiBuchung(buchung)) return invalidBody();
  // Die Bezeichnung gibt es nur an einer manuellen Zeile: die eines
  // Programmpunkts kommt von seinem POI (req-062).
  const bezeichnung =
    body.bezeichnung === undefined ? undefined : textOf(body.bezeichnung);
  if (bezeichnung !== undefined && bezeichnungProblem(bezeichnung)) {
    return invalidBody();
  }

  // Verknuepfbar sind nur Dokumente derselben Reise (req-062, Constraints)
  // -- geprueft wird das im Datenzugriff.
  const dokumentId =
    body.dokumentId === undefined ? undefined : textOf(body.dokumentId) || null;

  const activityId = textOf(body.activityId);
  const zeilenId = textOf(body.id);
  if (!activityId && !zeilenId) return invalidBody();

  const db = getPool();
  const accountId = session.accountId;

  // Eine manuelle Zeile traegt Preis und Buchungsstatus selbst -- einen POI
  // gibt es hinter ihr nicht.
  if (!activityId) {
    const ergebnis = await updateKostenzeile(db, accountId, zeilenId, {
      ...(bezeichnung === undefined ? {} : { bezeichnung }),
      ...(preis === undefined ? {} : { preisCent: preis }),
      ...(anzahl === undefined ? {} : { anzahl }),
      ...(buchung === undefined ? {} : { buchung }),
      ...(dokumentId === undefined ? {} : { dokumentId }),
    });
    if (!ergebnis.ok) return failure(ergebnis.reason);
    return Response.json({ zeile: ergebnis.zeile, poi: null });
  }

  // Die Bezeichnung einer Zeile aus dem Plan kommt vom POI und laesst sich
  // hier nicht setzen.
  if (bezeichnung !== undefined) return invalidBody();

  const activity = await findActivity(db, accountId, activityId);
  // Ein Programmpunkt eines anderen Accounts existiert fuer diese Sitzung
  // nicht.
  if (!activity) return failure("unknown");

  let poi: Poi | null = null;
  let zeile: GespeicherteKostenzeile | null = null;

  // Preis und Buchungsstatus stehen am POI und fliessen dorthin zurueck
  // (req-062) -- die Tabelle haelt keine zweite Kopie. Ohne POI gibt es
  // nichts, woran sie stehen koennten: dann traegt sie die Zeile selbst.
  if (activity.poiId) {
    if (preis !== undefined) {
      poi = await setPoiKostenCent(db, accountId, activity.poiId, preis);
      if (!poi) return failure("unknown");
    }
    if (buchung !== undefined) {
      poi = await setPoiBuchung(db, accountId, activity.poiId, buchung);
      if (!poi) return failure("unknown");
    }
  }

  // Die Anzahl gehoert immer an die Zeile: sie beschreibt, wie oft dieser
  // Programmpunkt zaehlt, und nicht den Ort.
  const aenderung: KostenzeileAenderung = {
    ...(anzahl === undefined ? {} : { anzahl }),
    ...(dokumentId === undefined ? {} : { dokumentId }),
    ...(activity.poiId || preis === undefined ? {} : { preisCent: preis }),
    ...(activity.poiId || buchung === undefined ? {} : { buchung }),
  };
  if (Object.keys(aenderung).length > 0) {
    const ergebnis = await saveKostenzeileZuProgrammpunkt(
      db,
      accountId,
      activityId,
      aenderung,
      new Date(),
    );
    if (!ergebnis.ok) return failure(ergebnis.reason);
    zeile = ergebnis.zeile;
  }

  return Response.json({ poi, zeile });
}
