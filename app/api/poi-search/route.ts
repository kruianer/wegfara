import { getPool } from "@/lib/db/pool";
import { createPois, listPois } from "@/lib/db/pois";
import { listSearchAreas } from "@/lib/db/search-area";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { searchPoisWithAi } from "@/lib/pois/ai-search";
import { POI_TYPES } from "@/lib/pois/type-meta";
import type { PoiType, PoiTypeFilter } from "@/lib/pois/types";
import { reverseGeocodeRegion } from "@/lib/osm/reverse-geocode";
import { findPlace } from "@/lib/osm/overpass-client";
import { createOpenAiClient } from "@/lib/ai/openai-client";
import { accountApiKey } from "@/lib/api-keys/account-keys";

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

  // Bezahlt wird die Anfrage vom Account, in dem gerade gearbeitet wird
  // (req-028). Ohne seinen eigenen Zugangsschluessel ist die Suche gesperrt
  // — auf den eines anderen Accounts oder aus den Umgebungsvariablen wird
  // nicht zurueckgegriffen. Geprueft wird das hier und nicht nur in der
  // Oberflaeche.
  const openAiKey = await accountApiKey(db, accountId, "ki_suche");
  if (!openAiKey) {
    return Response.json({ error: "kein Zugangsschluessel" }, { status: 409 });
  }

  const [searchAreas, pois] = await Promise.all([
    listSearchAreas(db, accountId),
    listPois(db, accountId),
  ]);

  const searchArea = searchAreas.find((a) => a.tripId === tripId)?.points;
  if (!searchArea) {
    return Response.json({ error: "no search area" }, { status: 400 });
  }

  const existingNames = pois
    .filter((p) => p.tripId === tripId)
    .map((p) => p.name);

  const ai = createOpenAiClient({ apiKey: openAiKey });
  const outcome = await searchPoisWithAi(
    { searchArea, typeFilter, wish, existingNames },
    {
      describeRegion: reverseGeocodeRegion,
      suggestNames: (prompt) => ai.complete(prompt),
      lookupPlace: findPlace,
    },
  );

  if (!outcome) {
    return Response.json({ error: "search failed" }, { status: 502 });
  }

  const createdPois = await createPois(db, tripId, outcome.drafts);

  return Response.json({
    addedCount: createdPois.length,
    discardedCount: outcome.discardedCount,
    createdPois,
  });
}
