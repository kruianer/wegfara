import { getPool } from "@/lib/db/pool";
import {
  createParticipant,
  deleteParticipant,
  emailTakenInAccount,
  findParticipantInAccount,
  updateParticipant,
} from "@/lib/db/participants";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import {
  PARTICIPANT_ERRORS,
  toParticipantInput,
  validateParticipantDraft,
  type ParticipantDraft,
  type ParticipantFieldErrors,
} from "@/lib/participants/validate";

/**
 * Personen anlegen, aendern und entfernen (siehe req-019). Die Pruefung der
 * Eingaben liegt in lib/participants/validate.ts und ist damit dieselbe wie
 * in der Karte "Reiseteilnehmer" -- ein Aufruf an dieser Schnittstelle
 * vorbei kann keine unzulaessige Person anlegen.
 *
 * Telefonnummer und Bankverbindung sind personenbezogene Daten und nur fuer
 * angemeldete Personen desselben Accounts sichtbar (siehe
 * delivery/security.md): jeder Zugriff prueft die Sitzung und filtert nach
 * dem Account der angemeldeten Person.
 *
 * Aendern darf hier nur, wer Account-Admin ist (req-027). Die Pruefung
 * liegt bewusst hier und nicht nur in der Oberflaeche: es genuegt nicht,
 * Schaltflaechen auszublenden -- ein Aufruf an der Karte vorbei wird ebenso
 * abgewiesen. Die Liste selbst bleibt fuer alle lesbar.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDraft(body: Record<string, unknown>): ParticipantDraft {
  return {
    name: textOf(body.name),
    nickname: textOf(body.nickname),
    email: textOf(body.email),
    phone: textOf(body.phone),
    iban: textOf(body.iban),
  };
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

function badRequest(errors: ParticipantFieldErrors) {
  return Response.json({ errors }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const accountId = session.accountId;
  const draft = parseDraft(body);
  const errors = validateParticipantDraft(draft);
  if (Object.keys(errors).length > 0) return badRequest(errors);

  const input = toParticipantInput(draft);
  if (
    input.email &&
    (await emailTakenInAccount(getPool(), accountId, input.email))
  ) {
    return badRequest({ email: PARTICIPANT_ERRORS.emailTaken });
  }

  const participant = await createParticipant(
    getPool(),
    accountId,
    input,
    new Date(),
  );
  return Response.json({ participant }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  const id = body ? textOf(body.id) : "";
  if (!body || id.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const accountId = session.accountId;
  // Eine Person eines anderen Accounts existiert fuer diese Sitzung nicht.
  const existing = await findParticipantInAccount(getPool(), accountId, id);
  if (!existing) {
    return Response.json({ error: "unknown participant" }, { status: 404 });
  }

  const draft = parseDraft(body);
  // Wer sich per Anmeldelink anmeldet, behaelt seine Adresse. Zugang ohne
  // Adresse gibt es seit req-023 -- wer per Einladung hereingekommen ist,
  // braucht keine.
  const errors = validateParticipantDraft(draft, {
    emailRequired: existing.loginEnabled && existing.email !== null,
  });
  if (Object.keys(errors).length > 0) return badRequest(errors);

  const input = toParticipantInput(draft);
  if (
    input.email &&
    (await emailTakenInAccount(getPool(), accountId, input.email, id))
  ) {
    return badRequest({ email: PARTICIPANT_ERRORS.emailTaken });
  }

  const participant = await updateParticipant(getPool(), accountId, id, input);
  if (!participant) {
    return Response.json({ error: "unknown participant" }, { status: 404 });
  }
  return Response.json({ participant });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  const id = body ? textOf(body.id) : "";
  if (!body || id.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  // Die eigene Person laesst sich nicht entfernen (req-019) -- sonst
  // entfiele mit ihr die Sitzung, mit der gerade gearbeitet wird.
  if (id === session.participant.id) {
    return Response.json({ error: "self" }, { status: 409 });
  }

  const deleted = await deleteParticipant(getPool(), session.accountId, id);
  if (!deleted) {
    return Response.json({ error: "unknown participant" }, { status: 404 });
  }
  return Response.json({ status: "ok" });
}
