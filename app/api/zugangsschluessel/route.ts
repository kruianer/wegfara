import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import {
  removeAccountApiKey,
  storeAccountApiKey,
} from "@/lib/api-keys/account-keys";
import { isApiKeyKind } from "@/lib/api-keys/types";

/**
 * Die Zugangsschluessel des Accounts setzen, ersetzen und entfernen
 * (req-028). Wer das darf, wird hier serverseitig geprueft: nur ein
 * Account-Admin -- der Gesamt-Admin gilt in jedem Account, in den er
 * gewechselt ist, als einer (req-027).
 *
 * Diese Schnittstelle gibt einen hinterlegten Schluessel nie zurueck. Was
 * sie liefert, ist ausschliesslich der Zustand: gesetzt oder nicht, und die
 * letzten vier Zeichen zur Unterscheidung. Einen Weg zum Auslesen gibt es
 * bewusst nicht -- auch kein GET.
 *
 * Der Account kommt aus der Sitzung und nie aus der Anfrage (req-024): ein
 * fremder Account laesst sich hier nicht adressieren.
 */

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

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const { kind } = body;
  const apiKey = typeof body.key === "string" ? body.key.trim() : "";
  if (!isApiKeyKind(kind) || apiKey.length === 0) return invalidBody();

  const keys = await storeAccountApiKey(
    getPool(),
    session.accountId,
    kind,
    apiKey,
    new Date(),
  );
  // Ohne AUTH_SECRET in der Umgebung liesse sich nur unverschluesselt
  // ablegen -- dann lieber gar nicht (req-028, Constraints).
  if (!keys) {
    return Response.json({ error: "keine Verschluesselung" }, { status: 503 });
  }

  return Response.json({ keys });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const { kind } = body;
  if (!isApiKeyKind(kind)) return invalidBody();

  const keys = await removeAccountApiKey(getPool(), session.accountId, kind);
  return Response.json({ keys });
}
