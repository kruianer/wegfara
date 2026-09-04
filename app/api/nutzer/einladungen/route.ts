import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { smtpMailer } from "@/lib/mail/smtp-mailer";
import { inviteUser } from "@/lib/invitations/invite-user";
import { invalidateAccessLinks } from "@/lib/db/access-links";
import { findParticipantInAccount } from "@/lib/db/participants";

export const dynamic = "force-dynamic";

/**
 * Einladen und Zuruecknehmen im Bereich "Nutzer" (req-038).
 *
 * Weitere Personen kommen ausschliesslich ueber eine Einladung herein --
 * eine offene Selbstregistrierung gibt es nicht. Verwalten darf das nur ein
 * Account-Admin; geprueft wird das hier und nicht nur in der Oberflaeche.
 *
 * Der Zugangslink kommt genau einmal im Klartext zurueck. Gespeichert wird
 * nur seine Pruefsumme; ein Zurueckziehen entwertet ihn serverseitig sofort.
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

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const result = await inviteUser(
    getPool(),
    smtpMailer,
    session.accountId,
    { name: textOf(body.name), email: textOf(body.email) },
    new Date(),
  );
  if (!result.ok)
    return Response.json({ errors: result.errors }, { status: 400 });

  return Response.json(
    { participant: result.participant, invitation: result.invitation },
    { status: 201 },
  );
}

/** Zieht eine offene Einladung zurueck -- der Link ist danach wertlos. */
export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  const participantId = body ? textOf(body.participantId) : "";
  if (!body || participantId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();
  // Eine Person eines anderen Accounts existiert fuer diese Sitzung nicht.
  const participant = await findParticipantInAccount(
    db,
    session.accountId,
    participantId,
  );
  if (!participant) {
    return Response.json({ error: "unknown participant" }, { status: 404 });
  }

  await invalidateAccessLinks(db, participantId, new Date());
  return Response.json({ status: "ok" });
}
