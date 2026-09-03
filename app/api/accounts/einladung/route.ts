import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized, forbidden } from "@/lib/auth/api-guard";
import { createFirstPersonInvitation } from "@/lib/invitations/create-invitation";

export const dynamic = "force-dynamic";

/**
 * Erzeugt den Zugangslink fuer die erste Person eines Accounts (req-025).
 * Der Link kommt hier ein einziges Mal im Klartext zurueck -- gespeichert
 * wird nur seine Pruefsumme.
 *
 * Vorbehalten ist das dem Gesamt-Admin: er legt den Account an und schickt
 * der ersten Person den Zugang. Ab dem Einloesen verwaltet sie ihn selbst.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();

  let accountId = "";
  try {
    const body = (await request.json()) as { accountId?: unknown };
    if (typeof body.accountId === "string") accountId = body.accountId.trim();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (accountId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const invitation = await createFirstPersonInvitation(
    getPool(),
    accountId,
    new Date(),
  );
  if (!invitation) {
    return Response.json({ error: "unknown account" }, { status: 404 });
  }

  return Response.json({ invitation }, { status: 201 });
}
