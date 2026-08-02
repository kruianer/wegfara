import { getPool } from "@/lib/db/pool";
import { createPois, listPois } from "@/lib/db/pois";
import { listSearchAreas } from "@/lib/db/search-area";
import { ACCOUNT_ID } from "@/lib/account";
import { searchPoisWithAi } from "@/lib/pois/ai-search";
import { POI_TYPES } from "@/lib/pois/type-meta";
import type { PoiType, PoiTypeFilter } from "@/lib/pois/types";
import { reverseGeocodeRegion } from "@/lib/osm/reverse-geocode";
import { findPlace } from "@/lib/osm/overpass-client";
import { openAiClient } from "@/lib/ai/openai-client";

function isTypeFilter(value: unknown): value is PoiTypeFilter {
  return (
    value === "alle" ||
    (typeof value === "string" && POI_TYPES.includes(value as PoiType))
  );
}

export async function POST(request: Request) {
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
  const [searchAreas, pois] = await Promise.all([
    listSearchAreas(db, ACCOUNT_ID),
    listPois(db, ACCOUNT_ID),
  ]);

  const searchArea = searchAreas.find((a) => a.tripId === tripId)?.points;
  if (!searchArea) {
    return Response.json({ error: "no search area" }, { status: 400 });
  }

  const existingNames = pois
    .filter((p) => p.tripId === tripId)
    .map((p) => p.name);

  const outcome = await searchPoisWithAi(
    { searchArea, typeFilter, wish, existingNames },
    {
      describeRegion: reverseGeocodeRegion,
      suggestNames: (prompt) => openAiClient.complete(prompt),
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
