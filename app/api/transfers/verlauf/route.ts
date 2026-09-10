import { getPool } from "@/lib/db/pool";
import { findActivity } from "@/lib/db/activities";
import { findTransfer } from "@/lib/db/transfers";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { createOsrmClient } from "@/lib/routing/osrm-client";
import { routenprofilFuer } from "@/lib/transfers/routenprofil";
import type { ActivityPosition } from "@/lib/activities/types";

/**
 * Der Strassenverlauf der Transfers eines Reisetages (req-059): daraus
 * zeichnet die Tageskarte im Planer die Linie zwischen zwei Programmpunkten,
 * statt sie gerade zu ziehen.
 *
 * Er laeuft ueber den Server, wie schon der Vorschlag (req-052): der
 * Routing-Dienst kann spaeter auf dem Beelink liegen, wo ihn kein Browser von
 * aussen erreicht. Was sich nicht ermitteln laesst -- stummer Dienst,
 * fehlende Position, ein Verkehrsmittel ohne Profil wie Flug oder Faehre --
 * fehlt in der Antwort; die Karte zeigt dort die gepunktete Gerade und keine
 * Fehlermeldung.
 */

/** So viele Transfers hat kein Reisetag -- die Grenze schuetzt den Dienst. */
const MAX_TRANSFERS = 25;

export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .slice(0, MAX_TRANSFERS);

  const pool = getPool();
  const osrm = createOsrmClient();

  const ermittelt = await Promise.all(
    // Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024).
    ids.map(async (id) => {
      const transfer = await findTransfer(pool, session.accountId, id);
      if (!transfer) return null;

      const profil = routenprofilFuer(transfer.mode);
      // Boot, Flug, Bahn und Faehre faehrt kein Routing-Dienst aus -- fuer
      // sie wird kein Strassenverlauf gezeichnet.
      if (!profil) return null;

      const [von, nach] = await Promise.all([
        findActivity(pool, session.accountId, transfer.fromActivityId),
        findActivity(pool, session.accountId, transfer.toActivityId),
      ]);
      if (!von?.position || !nach?.position) return null;

      const verlauf = await osrm.verlauf(von.position, nach.position, profil);
      return verlauf ? ([id, verlauf] as const) : null;
    }),
  );

  const verlaeufe: Record<string, ActivityPosition[]> = {};
  for (const eintrag of ermittelt) {
    if (eintrag) verlaeufe[eintrag[0]] = eintrag[1];
  }

  return Response.json({ verlaeufe });
}
