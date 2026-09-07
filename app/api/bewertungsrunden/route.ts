import { getPool } from "@/lib/db/pool";
import {
  endRatingRound,
  startRatingRound,
  type RundenFehler,
} from "@/lib/db/rating-rounds";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

/**
 * Die Bewertungsrunde (req-054): POST startet eine ueber die ausgewaehlten
 * POIs, PATCH beendet die laufende.
 *
 * Beides darf nur der Reiseleiter der Reise. Geprueft wird das in
 * lib/db/rating-rounds.ts und damit auch bei einem Aufruf an der Oberflaeche
 * vorbei; der Account kommt aus der Anmeldung, nie aus der Anfrage (req-024).
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

/** 403 fuer den Teilnehmer, 409 fuer eine schon laufende Runde, sonst 404. */
function failure(reason: RundenFehler) {
  if (reason === "notLeader") {
    return Response.json({ error: "notLeader" }, { status: 403 });
  }
  if (reason === "laeuft") {
    return Response.json({ error: "laeuft" }, { status: 409 });
  }
  if (reason === "keinePois") return invalidBody();
  return Response.json({ error: "unknown trip" }, { status: 404 });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const tripId = textOf(body.tripId);
  const poiIds = Array.isArray(body.poiIds)
    ? body.poiIds.map(textOf).filter((id) => id.length > 0)
    : [];
  if (tripId.length === 0 || poiIds.length === 0) return invalidBody();

  const result = await startRatingRound(
    getPool(),
    session.accountId,
    session.participant.id,
    tripId,
    poiIds,
    new Date(),
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ runde: result.runde });
}

export async function PATCH(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const roundId = textOf(body.roundId);
  if (roundId.length === 0) return invalidBody();

  const result = await endRatingRound(
    getPool(),
    session.accountId,
    session.participant.id,
    roundId,
    new Date(),
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ runde: result.runde });
}
