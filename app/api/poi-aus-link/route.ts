import { getPool } from "@/lib/db/pool";
import { savePoiFromGoogle } from "@/lib/db/pois";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { lookupPlaceFromGoogleLink } from "@/lib/pois/google-link-lookup";
import { mapGoogleTypesToPoiType } from "@/lib/google/type-mapping";
import { poiTextsFromGoogle } from "@/lib/google/description";
import { googlePlacesClient } from "@/lib/google/places-client";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { deriveOrt } from "@/lib/pois/derive-ort";
import { nominatimOrtLookup } from "@/lib/osm/ort-lookup";
import { uebernehmeGoogleFotos } from "@/lib/pois/google-photos";

/**
 * Legt aus einem eingefuegten Google-Maps-Link einen POI der geoeffneten
 * Reise an (req-026) — oder frischt ihn auf, wenn derselbe Ort dort schon
 * steht. Laesst sich der Link nicht auswerten oder der Ort nicht finden,
 * entsteht kein POI und die Antwort nennt den Grund.
 */
export async function POST(request: Request) {
  // Die Abfrage bei Google kostet Geld — ohne angemeldete Person wird sie
  // abgewiesen. Der Mandant ergibt sich aus der Anmeldung (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json()) as { tripId?: unknown; link?: unknown };
  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  const link = typeof body.link === "string" ? body.link : "";
  if (!tripId || !link.trim()) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();

  // Bezahlt wird die Abfrage vom Account, in dem gerade gearbeitet wird
  // (req-028). Ohne seinen eigenen Zugangsschluessel entsteht kein POI —
  // auf den eines anderen Accounts oder aus den Umgebungsvariablen wird
  // nicht zurueckgegriffen.
  const googleKey = await accountApiKey(db, session.accountId, "google");
  if (!googleKey) {
    return Response.json({ error: "kein Zugangsschluessel" }, { status: 409 });
  }
  const google = googlePlacesClient(googleKey);

  const lookup = await lookupPlaceFromGoogleLink(link, {
    resolveShortLink: (url) => google.resolveShortLink(url),
    findPlaceId: (query, position) => google.findPlaceId(query, position),
    placeDetails: (placeId) => google.placeDetails(placeId),
  });
  if (!lookup.ok) {
    return Response.json({ result: "fehler", reason: lookup.reason });
  }

  const { place } = lookup;
  // Der Ort kommt nicht von Google, sondern wird wie bei jedem anderen POI
  // aus Adresse oder Position abgeleitet (req-041). Bleibt er offen, laesst
  // savePoiFromGoogle den gespeicherten stehen.
  const ort = await deriveOrt(
    { address: place.address ?? null, position: place.position },
    nominatimOrtLookup,
  );
  // Kurz- und Langtext entstehen aus dem beschreibenden Text bei Google
  // (req-044); ein selbst geaenderter Text bleibt beim Auffrischen stehen.
  const texte = poiTextsFromGoogle(place.description);
  const gespeichert = await savePoiFromGoogle(db, session.accountId, tripId, {
    googlePlaceId: place.placeId,
    name: place.name,
    ort,
    type: mapGoogleTypesToPoiType(place.types),
    position: place.position,
    web: place.web,
    shortText: texte.shortText,
    longText: texte.longText,
    address: place.address,
    phone: place.phone,
    openingHours: place.openingHours,
  });
  // Eine Reise eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!gespeichert) {
    return Response.json({ error: "unknown trip" }, { status: 404 });
  }

  const poi = gespeichert.poi;
  poi.photos = await uebernehmeGoogleFotos(
    db,
    poi.id,
    place.photoNames,
    google,
  );

  return Response.json({
    result: gespeichert.created ? "angelegt" : "aufgefrischt",
    poi,
  });
}
