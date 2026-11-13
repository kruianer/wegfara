import { getPool } from "@/lib/db/pool";
import { createOsrmClient } from "@/lib/routing/osrm-client";
import {
  pruefeMitdenkaZugang,
  schluesselAusKopf,
} from "@/lib/werkzeuge/zugang";
import { kamUeberCloudflare } from "@/lib/werkzeuge/erreichbarkeit";
import {
  beantworte,
  JSON_RPC_FEHLER,
  rpcFehler,
} from "@/lib/werkzeuge/json-rpc";

// Haengt am Schluessel und an der Datenbank -- nie zwischenspeichern.
export const dynamic = "force-dynamic";

/**
 * Die Lese-Schnittstelle fuer mitdenka (req-104): `POST /api/werkzeuge` mit
 * JSON-RPC, Methoden `tools/list` und `tools/call`. mitdenka baut daraus
 * seinen MCP-Server; wegfara braucht kein MCP-SDK.
 *
 * Die Route gehoert nicht ins Internet: was ueber den Cloudflare-Tunnel
 * kommt, bekommt dieselbe Antwort wie eine Adresse, die es nicht gibt
 * (lib/werkzeuge/erreichbarkeit.ts).
 *
 * Der Account kommt allein aus dem Schluessel (`Authorization: Bearer …`),
 * nie aus einem Argument. Die middleware laesst die Route ohne Sitzung
 * durch; die Pruefung steht hier.
 */

function nichtErreichbar(): Response {
  return new Response("Not Found", { status: 404 });
}

export async function POST(request: Request) {
  if (kamUeberCloudflare(request.headers)) return nichtErreichbar();

  const schluessel = schluesselAusKopf(request.headers.get("authorization"));
  const db = getPool();
  const now = new Date();
  const accountId = schluessel
    ? await pruefeMitdenkaZugang(db, schluessel, now)
    : null;
  if (!accountId) {
    return Response.json(
      rpcFehler(null, JSON_RPC_FEHLER.nichtAngemeldet, "nicht angemeldet"),
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return Response.json(
      rpcFehler(null, JSON_RPC_FEHLER.unlesbar, "Kein gültiges JSON."),
    );
  }

  return Response.json(
    await beantworte(
      { db, now, routing: createOsrmClient() },
      accountId,
      rumpf,
    ),
  );
}

export function GET() {
  // Nur POST: ein GET verraet nicht einmal, dass es die Route gibt.
  return nichtErreichbar();
}
