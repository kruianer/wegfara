import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { findPoi, updatePoi } from "@/lib/db/pois";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { googlePlacesClient } from "@/lib/google/places-client";
import { ortZuPoi } from "@/lib/pois/google-vervollstaendigen";
import {
  googleOrtAusPlace,
  googleQuelleVonOrt,
  type GoogleOrt,
} from "@/lib/pois/google-ort";
import { googleOrtFuellung, gefuellteFelder } from "@/lib/pois/formular-fuellen";
import { nurLeereFelder } from "@/lib/pois/vervollstaendigen";
import { uebernehmeGoogleFotos } from "@/lib/pois/google-photos";
import { poiInputToValues, poiToInput } from "@/lib/pois/validate";

/**
 * „Aus Google vervollstaendigen" (req-061): Der gespeicherte POI wird bei
 * Google nachgeschlagen — ueber seine Kennung dort, sonst ueber Name und
 * Position — und alles, was an ihm noch leer ist, wird gefuellt. Was der
 * Nutzer selbst geschrieben hat, bleibt unangetastet.
 *
 * Gefuellt wird am gespeicherten POI, nicht nur im Formular: die Fotos aus
 * Google brauchen einen POI, zu dem sie gehoeren. Was dabei aus Google kam,
 * gilt nicht als von Hand geaendert (req-035) — ein spaeteres Auffrischen
 * darf es ersetzen.
 *
 * Der Abruf kostet je Aufruf ueber den Zugangsschluessel des Accounts
 * (req-028); deshalb laeuft er nur auf Knopfdruck. Findet Google den Ort
 * nicht oder scheitert der Abruf, nennt die Antwort den Grund und der POI
 * bleibt unveraendert (bug-021).
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    poiId?: unknown;
  } | null;
  const poiId = typeof body?.poiId === "string" ? body.poiId.trim() : "";
  if (poiId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();
  // Der Mandant kommt aus der Anmeldung (req-024): einen POI eines anderen
  // Accounts gibt es fuer diese Sitzung nicht.
  const poi = await findPoi(db, session.accountId, poiId);
  if (!poi) return Response.json({ error: "unknown poi" }, { status: 404 });

  // Bezahlt wird die Abfrage vom Account, in dem gearbeitet wird (req-028).
  // Ohne eigenen Schluessel wird nicht abgefragt; die Oberflaeche zeigt den
  // Knopf dann gar nicht erst.
  const googleKey = await accountApiKey(db, session.accountId, "google");
  if (!googleKey) {
    return Response.json({ error: "kein Zugangsschluessel" }, { status: 409 });
  }
  const google = googlePlacesClient(googleKey);

  const treffer = await ortZuPoi(poi, {
    placeDetails: (id) => google.placeDetails(id),
    findPlace: (query, position) => google.findPlace(query, position),
  });
  if (!treffer.ok) {
    return Response.json({ result: "fehler", reason: treffer.reason });
  }

  const ort = googleOrtAusPlace(treffer.place);
  // Gefuellt wird nur, was noch leer ist (req-061).
  const fuellung = nurLeereFelder(poiToInput(poi), googleOrtFuellung(ort));
  const gefuellt = gefuellteFelder(fuellung);

  const values = poiInputToValues({ ...poiToInput(poi), ...fuellung });
  // Ein gespeicherter POI ist immer gueltig; steht hier doch einmal nichts,
  // bleibt er unveraendert, statt halb geschrieben zu werden.
  if (!values) {
    return Response.json({
      result: "fehler",
      reason: "abfrage_fehlgeschlagen",
    });
  }

  // Der Ort bleibt, wie er ist: er wird nicht aus Google genommen, sondern
  // beim naechsten Speichern abgeleitet (req-041).
  const aktualisiert = await updatePoi(db, session.accountId, poi.id, values, {
    autoFilled: gefuellt,
    google: googleQuelleVonOrt(ort),
  });
  if (!aktualisiert) {
    return Response.json({ error: "unknown poi" }, { status: 404 });
  }

  const fotos = await fotosAusGoogle(db, aktualisiert, ort, google);
  if (fotos) aktualisiert.photos = fotos.photos;

  return Response.json({
    result: "gefunden",
    poi: aktualisiert,
    gefuellt,
    fotoProblem: fotos?.problem ?? null,
  });
}

/**
 * Die Fotos des Ortes — aber nur, wenn der POI noch keine hat (req-061):
 * eigene Bilder werden nicht gegen die von Google getauscht. Liefert null,
 * wenn es nichts zu holen gab.
 */
async function fotosAusGoogle(
  db: ReturnType<typeof getPool>,
  poi: { id: string; photos?: { id: string }[] },
  ort: GoogleOrt,
  google: ReturnType<typeof googlePlacesClient>,
) {
  if ((poi.photos ?? []).length > 0) return null;
  if (ort.photoNames.length === 0) return null;
  return uebernehmeGoogleFotos(db, poi.id, ort.photoNames, google);
}
