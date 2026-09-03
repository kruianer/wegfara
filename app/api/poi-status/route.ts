import { getPool } from "@/lib/db/pool";
import { setPoiStatus } from "@/lib/db/pois";
import { POI_STATUSES } from "@/lib/pois/status-meta";
import type { PoiStatus } from "@/lib/pois/types";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

export async function POST(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus der Anfrage (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json()) as {
    poiId?: string;
    status?: string;
  };
  const { poiId, status } = body;

  if (!poiId || !status || !POI_STATUSES.includes(status as PoiStatus)) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const gesetzt = await setPoiStatus(
    getPool(),
    session.accountId,
    poiId,
    status as PoiStatus,
  );
  // Ein POI eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!gesetzt) return Response.json({ error: "unknown poi" }, { status: 404 });

  return Response.json({ status: "ok" });
}
