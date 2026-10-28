import { getPool } from "@/lib/db/pool";
import { setPoiGegenden } from "@/lib/db/pois";
import { gegendZuLang } from "@/lib/pois/gegenden";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

/**
 * Dieselbe Gegend fuer mehrere angekreuzte POIs (req-098) -- gebaut nach
 * demselben Muster wie /api/poi-status fuer den Status (req-069). null nimmt
 * ihnen die Gegend.
 */
export async function POST(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus der Anfrage (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json()) as {
    poiIds?: unknown;
    gegend?: unknown;
  };
  const poiIds = Array.isArray(body.poiIds)
    ? body.poiIds.filter((id): id is string => typeof id === "string" && !!id)
    : [];
  const { gegend } = body;

  if (poiIds.length === 0 || (gegend !== null && typeof gegend !== "string")) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  // Die Gegend ist ein Kuerzel (req-101) -- eine laengere wird abgewiesen,
  // nicht gekuerzt.
  if (gegendZuLang(gegend)) {
    return Response.json({ error: "gegend zu lang" }, { status: 400 });
  }

  const gesetzte = await setPoiGegenden(
    getPool(),
    session.accountId,
    poiIds,
    gegend,
  );
  // POIs eines anderen Accounts existieren fuer diese Sitzung nicht.
  if (gesetzte.length === 0) {
    return Response.json({ error: "unknown poi" }, { status: 404 });
  }

  return Response.json({ status: "ok", updatedIds: gesetzte });
}
