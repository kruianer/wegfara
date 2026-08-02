import { getPool } from "@/lib/db/pool";
import { setPoiStatus } from "@/lib/db/pois";
import { POI_STATUSES } from "@/lib/pois/status-meta";
import type { PoiStatus } from "@/lib/pois/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    poiId?: string;
    status?: string;
  };
  const { poiId, status } = body;

  if (!poiId || !status || !POI_STATUSES.includes(status as PoiStatus)) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  await setPoiStatus(getPool(), poiId, status as PoiStatus);
  return Response.json({ status: "ok" });
}
