import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { createOpenAiClient } from "@/lib/ai/openai-client";
import { schlageBeschreibungVor } from "@/lib/pois/beschreibung";
import { POI_TYPES } from "@/lib/pois/type-meta";
import type { PoiType } from "@/lib/pois/types";

/**
 * Der Vorschlag fuer Kurz- und Langtext eines POI (req-058).
 *
 * Er kostet ueber den Zugangsschluessel des Accounts (req-028) und laeuft
 * deshalb nur auf ausdruecklichen Knopfdruck -- geprueft wird das hier und
 * nicht nur in der Oberflaeche. Ohne Schluessel wird gar nicht erst gefragt.
 */

function isPoiType(value: unknown): value is PoiType {
  return typeof value === "string" && POI_TYPES.includes(value as PoiType);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json()) as {
    name?: unknown;
    type?: unknown;
    ort?: unknown;
    address?: unknown;
  };

  const name = text(body.name);
  if (!name || !isPoiType(body.type)) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const apiKey = await accountApiKey(getPool(), session.accountId, "ki_suche");
  if (!apiKey) {
    return Response.json({ error: "missing key" }, { status: 400 });
  }

  const beschreibung = await schlageBeschreibungVor(
    createOpenAiClient({ apiKey }),
    {
      name,
      type: body.type,
      ort: text(body.ort),
      address: text(body.address),
    },
  );

  // Ein Fehlschlag bleibt einer -- die Oberflaeche sagt es dann (bug-021),
  // statt ein leeres Feld wie einen Vorschlag aussehen zu lassen.
  if (!beschreibung) {
    return Response.json({ error: "no suggestion" }, { status: 502 });
  }

  return Response.json({ beschreibung });
}
