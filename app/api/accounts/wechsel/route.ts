import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized, forbidden } from "@/lib/auth/api-guard";
import {
  returnToOwnAccount,
  switchToAccount,
} from "@/lib/accounts/switch-account";

export const dynamic = "force-dynamic";

/**
 * Wechselt in einen fremden Account und wieder zurueck (req-025). Nur der
 * Gesamt-Admin darf das; fuer alle anderen ist es eine bewusste Ausnahme,
 * die es nicht gibt.
 *
 * Der gewaehlte Account landet in der Sitzung, nicht in den folgenden
 * Anfragen: aus der Anfrage kommt die Kennung genau hier ein einziges Mal
 * und danach nie wieder (req-024). Ein POST ohne Kennung ist die Rueckkehr
 * in den eigenen Account.
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

  const db = getPool();
  if (accountId.length === 0) {
    await returnToOwnAccount(db, session);
    return Response.json({ status: "ok" });
  }

  const gewechselt = await switchToAccount(db, session, accountId, new Date());
  if (!gewechselt) {
    return Response.json({ error: "unknown account" }, { status: 404 });
  }
  return Response.json({ status: "ok" });
}
