import { getPool } from "@/lib/db/pool";
import { createPois, listPois } from "@/lib/db/pois";
import { findTrip } from "@/lib/db/trips";
import { listSearchAreas } from "@/lib/db/search-area";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { searchPoisWithAi } from "@/lib/pois/ai-search";
import { uebernehmeGoogleFotos } from "@/lib/pois/google-photos";
import { POI_TYPES } from "@/lib/pois/type-meta";
import type { Poi, PoiType, PoiTypeFilter } from "@/lib/pois/types";
import { reverseGeocodeRegion } from "@/lib/osm/reverse-geocode";
import { createOpenAiClient } from "@/lib/ai/openai-client";
import { googlePlacesClient } from "@/lib/google/places-client";
import { accountApiKey } from "@/lib/api-keys/account-keys";

/**
 * Die KI-Suche nach POIs im gezeichneten Suchgebiet (req-014, req-057).
 *
 * Sie kostet zweierlei Geld und braucht deshalb zwei Zugangsschluessel des
 * Accounts (req-028): den fuer das Sprachmodell, das die Orte vorschlaegt,
 * und den fuer Google Places, wo sie mit Foto und Bewertung nachgeschlagen
 * werden. Fehlt einer, sucht die Schnittstelle gar nicht erst — geprueft
 * wird das hier und nicht nur in der Oberflaeche.
 */

function isTypeFilter(value: unknown): value is PoiTypeFilter {
  return (
    value === "alle" ||
    (typeof value === "string" && POI_TYPES.includes(value as PoiType))
  );
}

export async function POST(request: Request) {
  // Diese Suche loest eine KI-Anfrage aus, die Geld kostet — ohne
  // angemeldete Person wird sie abgewiesen (req-016).
  const session = await currentSession();
  if (!session) return unauthorized();
  const accountId = session.accountId;

  const body = (await request.json()) as {
    tripId?: string;
    typeFilter?: unknown;
    wish?: unknown;
  };
  const { tripId } = body;
  const typeFilter = isTypeFilter(body.typeFilter) ? body.typeFilter : "alle";
  const wish = typeof body.wish === "string" ? body.wish : "";

  if (!tripId) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();

  // Bezahlt werden beide Anfragen vom Account, in dem gerade gearbeitet wird
  // (req-028). Ohne seine eigenen Zugangsschluessel ist die Suche gesperrt
  // — auf die eines anderen Accounts oder aus den Umgebungsvariablen wird
  // nicht zurueckgegriffen.
  const openAiKey = await accountApiKey(db, accountId, "ki_suche");
  if (!openAiKey) {
    return Response.json(
      { error: "kein Zugangsschluessel", fehlt: "ki_suche" },
      { status: 409 },
    );
  }
  // Ohne Google-Schluessel gaebe es weder Foto noch Bewertung — dann wird
  // gar nicht erst gesucht (req-057, Constraints).
  const googleKey = await accountApiKey(db, accountId, "google");
  if (!googleKey) {
    return Response.json(
      { error: "kein Zugangsschluessel", fehlt: "google" },
      { status: 409 },
    );
  }

  const [trip, searchAreas, pois] = await Promise.all([
    findTrip(db, accountId, tripId),
    listSearchAreas(db, accountId),
    listPois(db, accountId),
  ]);

  // Eine Reise eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  const searchArea = searchAreas.find((a) => a.tripId === tripId)?.points;
  if (!searchArea) {
    return Response.json({ error: "no search area" }, { status: 400 });
  }

  const vorhandene = pois.filter((p) => p.tripId === tripId);
  const existingNames = vorhandene.map((p) => p.name);
  const existingPlaceIds = vorhandene
    .map((p) => p.googlePlaceId)
    .filter((id): id is string => typeof id === "string");

  const ai = createOpenAiClient({ apiKey: openAiKey });
  const google = googlePlacesClient(googleKey);
  const outcome = await searchPoisWithAi(
    {
      searchArea,
      typeFilter,
      wish,
      existingNames,
      existingPlaceIds,
      // Die Praeferenzen der Reise (req-057) — sie stehen in den
      // Reisedetails und wirken allein hier.
      praeferenzen: trip.praeferenzen,
    },
    {
      describeRegion: reverseGeocodeRegion,
      suggestPlaces: (prompt) => ai.complete(prompt),
      // Die KI-Suche kennt nur "gefunden" oder "nicht gefunden": ein von
      // Google abgewiesener Zugang zaehlt hier wie ein Name ohne Treffer.
      lookupPlace: async (name, box) => {
        const abfrage = await google.findPlaceInArea(name, box);
        return abfrage.ok ? abfrage.treffer : null;
      },
    },
  );

  if (!outcome) {
    return Response.json({ error: "search failed" }, { status: 502 });
  }

  const createdPois = await createPois(
    db,
    tripId,
    outcome.treffer.map((treffer) => treffer.draft),
  );

  // Zu jedem neuen POI sein Foto (req-057). Genau eines: mehrere je POI aus
  // der Suche sind ausdruecklich nicht Teil des Requirements.
  const mitFotos: Poi[] = [];
  for (const [index, poi] of createdPois.entries()) {
    const photoNames = outcome.treffer[index].photoNames.slice(0, 1);
    poi.photos = await uebernehmeGoogleFotos(db, poi.id, photoNames, google);
    mitFotos.push(poi);
  }

  return Response.json({
    addedCount: mitFotos.length,
    discardedCount: outcome.discardedCount,
    createdPois: mitFotos,
  });
}
