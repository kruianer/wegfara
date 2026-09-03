import { getPool } from "@/lib/db/pool";
import { clearSearchArea, setSearchArea } from "@/lib/db/search-area";
import type { PoiPosition } from "@/lib/pois/types";
import { MIN_SEARCH_AREA_POINTS } from "@/lib/pois/search-area";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

function isPoint(value: unknown): value is PoiPosition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PoiPosition).lat === "number" &&
    typeof (value as PoiPosition).lng === "number"
  );
}

export async function POST(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus der Anfrage (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

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

  const gespeichert = await setSearchArea(
    getPool(),
    session.accountId,
    tripId,
    points,
  );
  // Eine Reise eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!gespeichert) {
    return Response.json({ error: "unknown trip" }, { status: 404 });
  }

  return Response.json({ status: "ok" });
}

export async function DELETE(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus der Anfrage (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json()) as { tripId?: string };
  const { tripId } = body;

  if (!tripId) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const geloescht = await clearSearchArea(getPool(), session.accountId, tripId);
  if (!geloescht) {
    return Response.json({ error: "unknown trip" }, { status: 404 });
  }

  return Response.json({ status: "ok" });
}
