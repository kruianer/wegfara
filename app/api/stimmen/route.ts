import { getPool } from "@/lib/db/pool";
import { castVote, type StimmFehler } from "@/lib/db/rating-rounds";
import { istStimmWahl } from "@/lib/bewertungen/types";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

/**
 * Die Stimme eines Teilnehmers zu einem POI einer laufenden Bewertungsrunde
 * (req-054). Solange die Runde laeuft, ersetzt eine neue Stimme die vorherige.
 *
 * Wer nicht zu der Reise gehoert, stimmt nicht ab -- geprueft wird das
 * serverseitig in lib/db/rating-rounds.ts; der Account kommt aus der
 * Anmeldung, nie aus der Anfrage (req-024).
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

/** 403 fuer Fremde, 409 fuer die beendete Runde, sonst 404. */
function failure(reason: StimmFehler) {
  if (reason === "notInTrip") {
    return Response.json({ error: "notInTrip" }, { status: 403 });
  }
  if (reason === "beendet") {
    return Response.json({ error: "beendet" }, { status: 409 });
  }
  return Response.json({ error: "unknown poi" }, { status: 404 });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  let body: Record<string, unknown>;
  try {
    const gelesen = await request.json();
    if (typeof gelesen !== "object" || gelesen === null) return invalidBody();
    body = gelesen as Record<string, unknown>;
  } catch {
    return invalidBody();
  }

  const roundId = textOf(body.roundId);
  const poiId = textOf(body.poiId);
  const { wahl } = body;
  if (roundId.length === 0 || poiId.length === 0 || !istStimmWahl(wahl)) {
    return invalidBody();
  }

  const result = await castVote(
    getPool(),
    session.accountId,
    session.participant.id,
    roundId,
    poiId,
    wahl,
    new Date(),
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ stimme: result.stimme });
}
