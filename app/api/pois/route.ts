import { getPool } from "@/lib/db/pool";
import {
  createPoi,
  deletePois,
  updatePoi,
  type PoiHerkunft,
} from "@/lib/db/pois";
import type { Queryable } from "@/lib/db/queryable";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { googlePlacesClient, MAX_PHOTOS } from "@/lib/google/places-client";
import { uebernehmeGoogleFotos } from "@/lib/pois/google-photos";
import { isPoiType } from "@/lib/pois/type-meta";
import { isPoiStatus } from "@/lib/pois/status-meta";
import { parseManualFields } from "@/lib/pois/manual-fields";
import type { PoiGoogleQuelle } from "@/lib/pois/google-ort";
import {
  emptyPoiInput,
  poiInputToValues,
  validatePoiInput,
  type PoiInput,
} from "@/lib/pois/validate";
import { deriveOrt } from "@/lib/pois/derive-ort";
import { nominatimOrtLookup } from "@/lib/osm/ort-lookup";
import type { PoiPosition, PoiValues } from "@/lib/pois/types";

/**
 * POIs von Hand anlegen, aendern und entfernen (req-035). Alle drei sind
 * Vorgaenge, bei denen der Nutzer eine Bestaetigung erwartet -- sie werden
 * sofort geschrieben, nicht verzoegert (siehe delivery/stack.md,
 * Conventions).
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024):
 * Reisen und POIs anderer Accounts existieren fuer diese Sitzung nicht.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positionOf(value: unknown): PoiPosition | null {
  const record = value as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(record?.lat);
  const lng = Number(record?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Ausserhalb dieser Grenzen liegt kein Ort der Erde.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Die Anfrage als Formularstand -- geprueft wird er wie in der Oberflaeche. */
function toInput(body: Record<string, unknown>): PoiInput {
  const vorgabe = emptyPoiInput();
  return {
    name: textOf(body.name),
    ort: textOf(body.ort),
    type: isPoiType(body.type) ? body.type : vorgabe.type,
    position: positionOf(body.position),
    status: isPoiStatus(body.status) ? body.status : vorgabe.status,
    shortText: textOf(body.shortText),
    longText: textOf(body.longText),
    address: textOf(body.address),
    web: textOf(body.web),
    phone: textOf(body.phone),
    openingHours: textOf(body.openingHours),
  };
}

/**
 * Woher die Werte stammen, die das Formular schickt (req-048): was sein
 * Suchfeld gefuellt hat, und der bei Google nachgeschlagene Ort dahinter.
 * Beides ist freiwillig -- wer das Suchfeld nicht benutzt, schickt es nicht.
 */
function herkunftOf(body: Record<string, unknown>): PoiHerkunft {
  const roh = Array.isArray(body.autoFilled) ? body.autoFilled : [];
  return {
    // Dieselbe Lesart wie bei der Spalte selbst: Unbekanntes faellt weg.
    autoFilled: parseManualFields(roh.map(textOf).join(",")),
    google: googleQuelleOf(body.google),
  };
}

function googleQuelleOf(value: unknown): PoiGoogleQuelle | null {
  const record = value as Record<string, unknown> | null;
  const placeId = textOf(record?.placeId).trim();
  if (placeId.length === 0) return null;

  const photoNames = Array.isArray(record?.photoNames)
    ? record.photoNames
        .map(textOf)
        .filter((name) => name.length > 0)
        // Hoechstens drei Fotos je Ort, wie sie Google auch liefert
        // (req-026) -- eine laengere Liste holte nur unnoetig Bilder.
        .slice(0, MAX_PHOTOS)
    : [];

  return {
    placeId,
    bewertung: zahlOf(record?.bewertung),
    bewertungAnzahl: zahlOf(record?.bewertungAnzahl),
    photoNames,
  };
}

function zahlOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Holt die Fotos des bei Google nachgeschlagenen Ortes und legt sie zum POI
 * ab (req-048) -- erst jetzt, denn vorher gab es keinen POI, zu dem sie
 * gehoeren koennten. Bezahlt wird das ueber den Zugangsschluessel des
 * Accounts (req-028); ohne ihn bleibt der POI ohne Bilder.
 *
 * Liefert null, wenn es nichts zu holen gab -- dann bleiben die Bilder des
 * POI, wie sie waren.
 */
async function fotosAusGoogle(
  db: Queryable,
  accountId: string,
  poiId: string,
  photoNames: string[],
) {
  if (photoNames.length === 0) return null;
  const googleKey = await accountApiKey(db, accountId, "google");
  if (!googleKey) return null;
  return uebernehmeGoogleFotos(
    db,
    poiId,
    photoNames,
    googlePlacesClient(googleKey),
  );
}

/**
 * Der Ort wird nicht eingegeben, sondern beim Speichern abgeleitet (req-041):
 * aus der Adresse, sonst aus der Position. Laesst er sich nicht ermitteln,
 * bleibt er offen -- der gespeicherte Ort bleibt dann stehen, und das
 * Speichern gelingt trotzdem.
 */
async function mitAbgeleitetemOrt(values: PoiValues): Promise<PoiValues> {
  const ort = await deriveOrt(
    { address: values.address, position: values.position },
    nominatimOrtLookup,
  );
  return { ...values, ort };
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
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

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const tripId = textOf(body.tripId).trim();
  if (tripId.length === 0) return invalidBody();

  const input = toInput(body);
  const errors = validatePoiInput(input);
  const values = poiInputToValues(input);
  // Ohne Name oder Position entsteht kein POI (req-035) -- dieselbe
  // Pruefung laeuft schon im Formular.
  if (!values) return Response.json({ errors }, { status: 400 });

  const db = getPool();
  const herkunft = herkunftOf(body);
  const poi = await createPoi(
    db,
    session.accountId,
    tripId,
    await mitAbgeleitetemOrt(values),
    herkunft,
  );
  if (!poi) return Response.json({ error: "unknown trip" }, { status: 404 });

  const fotos = await fotosAusGoogle(
    db,
    session.accountId,
    poi.id,
    herkunft.google?.photoNames ?? [],
  );
  if (fotos) poi.photos = fotos;

  return Response.json({ poi }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id).trim();
  if (id.length === 0) return invalidBody();

  const input = toInput(body);
  const errors = validatePoiInput(input);
  const values = poiInputToValues(input);
  if (!values) return Response.json({ errors }, { status: 400 });

  const db = getPool();
  const herkunft = herkunftOf(body);
  // Die Nummer steht nicht im Formularstand und wird deshalb nie
  // geschrieben -- sie bleibt nach der Vergabe fest (req-013).
  const poi = await updatePoi(
    db,
    session.accountId,
    id,
    await mitAbgeleitetemOrt(values),
    herkunft,
  );
  if (!poi) return Response.json({ error: "unknown poi" }, { status: 404 });

  const fotos = await fotosAusGoogle(
    db,
    session.accountId,
    poi.id,
    herkunft.google?.photoNames ?? [],
  );
  if (fotos) poi.photos = fotos;

  return Response.json({ poi });
}

/**
 * Die zu entfernenden POIs aus der Anfrage: einer (`id`, req-035) oder
 * mehrere angekreuzte (`ids`, req-057). Beides derselbe Vorgang — was
 * gelöscht wird, verschwindet vollstaendig, Datensatz wie Bilddatei.
 */
function toDeleteIds(body: Record<string, unknown>): string[] {
  const einzeln = textOf(body.id).trim();
  if (einzeln.length > 0) return [einzeln];
  if (!Array.isArray(body.ids)) return [];
  return [...new Set(body.ids.map((id) => textOf(id).trim()))].filter(
    (id) => id.length > 0,
  );
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const ids = toDeleteIds(body);
  if (ids.length === 0) return invalidBody();

  // Zuerst die Datensaetze, dann die Dateien (wie bei den Dokumenten,
  // req-034): so bleibt nie ein Datensatz zurueck, der ins Leere zeigt.
  const entfernt = await deletePois(getPool(), session.accountId, ids);
  // Keiner der genannten POIs gehoert zu diesem Account (req-024) -- fuer
  // diese Sitzung gibt es sie nicht.
  if (entfernt.pois.length === 0) {
    return Response.json({ error: "unknown poi" }, { status: 404 });
  }

  if (entfernt.removedFileNames.length > 0) {
    try {
      const store = fileSystemPhotoStore();
      for (const fileName of entfernt.removedFileNames) {
        await store.remove(fileName).catch(() => {});
      }
    } catch {
      // Ohne Bildverzeichnis gibt es nichts zu raeumen; der POI ist weg.
    }
  }

  return Response.json({
    status: "ok",
    removedIds: entfernt.pois.map((poi) => poi.id),
  });
}
