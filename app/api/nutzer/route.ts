import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { listAccountUsers, listOpenInvitations } from "@/lib/db/account-users";

export const dynamic = "force-dynamic";

/**
 * Der Bereich "Nutzer" (req-038): die Personen des Accounts mit Beitritt und
 * letzter Anmeldung, dazu die offenen Einladungen.
 *
 * Ihn sieht ausschliesslich ein Account-Admin -- und der Gesamt-Admin im
 * Account, in den er gewechselt ist. Ein Teilnehmer ohne diese
 * Kennzeichnung wird hier abgewiesen, auch wenn er die Adresse direkt
 * aufruft: das Ausblenden in der Oberflaeche ersetzt diese Pruefung nicht.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const db = getPool();
  const now = new Date();
  const [users, invitations] = await Promise.all([
    listAccountUsers(db, session.accountId),
    listOpenInvitations(db, session.accountId, now),
  ]);
  return Response.json({ users, invitations });
}
