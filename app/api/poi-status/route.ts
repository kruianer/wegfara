import { getPool } from "@/lib/db/pool";
import { setPoiStatuses } from "@/lib/db/pois";
import { POI_STATUSES } from "@/lib/pois/status-meta";
import type { PoiStatus } from "@/lib/pois/types";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

/** Die genannten POIs -- einer (req-010) oder mehrere auf einmal (req-069). */
function toPoiIds(body: { poiId?: string; poiIds?: unknown }): string[] {
  const viele = Array.isArray(body.poiIds)
    ? body.poiIds.filter((id): id is string => typeof id === "string" && !!id)
    : [];
  if (viele.length > 0) return viele;
  return body.poiId ? [body.poiId] : [];
}

export async function POST(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus der Anfrage (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json()) as {
    poiId?: string;
    poiIds?: unknown;
    status?: string;
  };
  const { status } = body;
  const poiIds = toPoiIds(body);

  if (
    poiIds.length === 0 ||
    !status ||
    !POI_STATUSES.includes(status as PoiStatus)
  ) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  // Wer den Status eines einzelnen POI setzen darf, darf es auch fuer
  // mehrere (req-069, Constraints) -- es kommt kein Recht hinzu.
  const gesetzte = await setPoiStatuses(
    getPool(),
    session.accountId,
    poiIds,
    status as PoiStatus,
  );
  // POIs eines anderen Accounts existieren fuer diese Sitzung nicht.
  if (gesetzte.length === 0) {
    return Response.json({ error: "unknown poi" }, { status: 404 });
  }

  return Response.json({ status: "ok", updatedIds: gesetzte });
}
