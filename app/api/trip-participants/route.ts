import { getPool } from "@/lib/db/pool";
import {
  assignTripParticipant,
  removeTripParticipant,
  type TripParticipantFailure,
} from "@/lib/db/trip-participants";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { isTripRole } from "@/lib/trip-participants/rules";

/**
 * Wer bei einer Reise mitfaehrt und in welcher Rolle (siehe req-021). Die
 * Regeln liegen in lib/trip-participants/rules.ts und sind damit dieselben
 * wie in der Karte "Wer faehrt mit" -- ein Aufruf an dieser Schnittstelle
 * vorbei kann den letzten Reiseleiter genauso wenig entfernen.
 *
 * Reisen und Personen anderer Mandanten existieren fuer diese Sitzung
 * nicht: jeder Zugriff filtert nach dem Account der angemeldeten Person.
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

/** 404 fuer Unbekanntes, 409 fuer den letzten Reiseleiter. */
function failure(reason: TripParticipantFailure) {
  return reason === "lastLeader"
    ? Response.json({ error: "lastLeader" }, { status: 409 })
    : Response.json({ error: "unknown trip participant" }, { status: 404 });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const tripId = textOf(body.tripId);
  const participantId = textOf(body.participantId);
  const { role } = body;
  if (tripId.length === 0 || participantId.length === 0 || !isTripRole(role)) {
    return invalidBody();
  }

  const result = await assignTripParticipant(
    getPool(),
    session.accountId,
    tripId,
    participantId,
    role,
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ tripParticipant: result.tripParticipant });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const tripId = textOf(body.tripId);
  const participantId = textOf(body.participantId);
  if (tripId.length === 0 || participantId.length === 0) return invalidBody();

  const result = await removeTripParticipant(
    getPool(),
    session.accountId,
    tripId,
    participantId,
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ status: "ok" });
}
