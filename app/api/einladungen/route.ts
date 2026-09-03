import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { createInvitation } from "@/lib/invitations/create-invitation";

export const dynamic = "force-dynamic";

/**
 * Erzeugt eine Einladung fuer eine Person der eigenen Reise (req-023). Der
 * Zugangslink kommt hier ein einziges Mal im Klartext zurueck -- gespeichert
 * wird nur seine Pruefsumme.
 *
 * Personen anderer Mandanten existieren fuer diese Sitzung nicht: die
 * Pruefung liegt in lib/invitations/create-invitation.ts und filtert nach
 * dem Account der angemeldeten Person.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  let participantId = "";
  try {
    const body = (await request.json()) as { participantId?: unknown };
    if (typeof body.participantId === "string") {
      participantId = body.participantId.trim();
    }
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (participantId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const invitation = await createInvitation(
    getPool(),
    session.participant.accountId,
    participantId,
    new Date(),
  );
  if (!invitation) {
    return Response.json({ error: "unknown participant" }, { status: 404 });
  }

  return Response.json({ invitation }, { status: 201 });
}
