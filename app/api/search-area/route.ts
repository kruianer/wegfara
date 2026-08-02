import { getPool } from "@/lib/db/pool";
import { clearSearchArea, setSearchArea } from "@/lib/db/search-area";
import type { PoiPosition } from "@/lib/pois/types";
import { MIN_SEARCH_AREA_POINTS } from "@/lib/pois/search-area";

function isPoint(value: unknown): value is PoiPosition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PoiPosition).lat === "number" &&
    typeof (value as PoiPosition).lng === "number"
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    tripId?: string;
    points?: unknown;
  };
  const { tripId, points } = body;

  if (
    !tripId ||
    !Array.isArray(points) ||
    points.length < MIN_SEARCH_AREA_POINTS ||
    !points.every(isPoint)
  ) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  await setSearchArea(getPool(), tripId, points);
  return Response.json({ status: "ok" });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { tripId?: string };
  const { tripId } = body;

  if (!tripId) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  await clearSearchArea(getPool(), tripId);
  return Response.json({ status: "ok" });
}
