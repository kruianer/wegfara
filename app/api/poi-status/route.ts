import { getPool } from "@/lib/db/pool";
import { setPoiStatus } from "@/lib/db/pois";
import { POI_STATUSES } from "@/lib/pois/status-meta";
import type { PoiStatus } from "@/lib/pois/types";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

export async function POST(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016).
  if (!(await currentSession())) return unauthorized();

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
