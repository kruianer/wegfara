import { getPool } from "@/lib/db/pool";
import {
  setAccountAdmin,
  type AccountAdminFailure,
} from "@/lib/db/participants";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";

/**
 * Die Kennzeichnung Account-Admin einer Person setzen und entziehen
 * (req-027). Ernennen darf nur, wer sie selbst traegt -- der Gesamt-Admin
 * gilt in jedem Account, in den er gewechselt ist, als Account-Admin.
 *
 * Die Regel dahinter liegt in lib/participants/account-admin.ts und ist
 * damit dieselbe wie in der Karte "Reiseteilnehmer": ein Aufruf an der
 * Karte vorbei kann dem letzten Account-Admin die Kennzeichnung genauso
 * wenig entziehen.
 *
 * Personen anderer Mandanten existieren fuer diese Sitzung nicht: der
 * Zugriff filtert nach dem Account, in dem gerade gearbeitet wird.
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

/** 404 fuer Unbekanntes, 409 fuer den letzten Account-Admin. */
function failure(reason: AccountAdminFailure) {
  return reason === "lastAdmin"
    ? Response.json({ error: "lastAdmin" }, { status: 409 })
    : Response.json({ error: "unknown participant" }, { status: 404 });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const id = textOf(body.id);
  const { accountAdmin } = body;
  if (id.length === 0 || typeof accountAdmin !== "boolean") {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const result = await setAccountAdmin(
    getPool(),
    session.accountId,
    id,
    accountAdmin,
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ participant: result.participant });
}
