import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { lookupPlaceFromGoogleLink } from "@/lib/pois/google-link-lookup";
import { googlePlacesClient } from "@/lib/google/places-client";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { googleOrtAusPlace } from "@/lib/pois/google-ort";

/**
 * Schlaegt den Ort hinter einem eingefuegten Google-Maps-Link nach (req-048)
 * — fuer das Suchfeld am Anfang des POI-Formulars, das sich daraus fuellt.
 *
 * Hier entsteht kein POI: gespeichert wird erst das Formular ueber
 * /api/pois. Bis req-026 legte der eigene Bereich ueber der POI-Liste den
 * POI unmittelbar an; dieser Weg ist mit req-048 entfallen.
 *
 * Laesst sich der Link nicht auswerten oder der Ort nicht finden, nennt die
 * Antwort den Grund — die Felder des Formulars bleiben dann unveraendert.
 */
export async function POST(request: Request) {
  // Die Abfrage bei Google kostet Geld — ohne angemeldete Person wird sie
  // abgewiesen. Der Mandant ergibt sich aus der Anmeldung (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json()) as { link?: unknown };
  const link = typeof body.link === "string" ? body.link : "";
  if (!link.trim()) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  // Bezahlt wird die Abfrage vom Account, in dem gerade gearbeitet wird
  // (req-028). Ohne seinen eigenen Zugangsschluessel wird nicht abgefragt —
  // auf den eines anderen Accounts oder aus den Umgebungsvariablen wird nie
  // zurueckgegriffen. Die Oberflaeche weist schon am Feld darauf hin und
  // fragt gar nicht erst an.
  const googleKey = await accountApiKey(getPool(), session.accountId, "google");
  if (!googleKey) {
    return Response.json({ error: "kein Zugangsschluessel" }, { status: 409 });
  }
  const google = googlePlacesClient(googleKey);

  const lookup = await lookupPlaceFromGoogleLink(link, {
    resolveShortLink: (url) => google.resolveShortLink(url),
    findPlace: (query, position) => google.findPlace(query, position),
    placeDetails: (placeId) => google.placeDetails(placeId),
  });
  if (!lookup.ok) {
    return Response.json({ result: "fehler", reason: lookup.reason });
  }

  return Response.json({
    result: "gefunden",
    ort: googleOrtAusPlace(lookup.place),
  });
}
