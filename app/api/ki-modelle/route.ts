import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { saveAccountKiModell } from "@/lib/db/account-ki-modelle";
import { kiModelleStand } from "@/lib/ki-modelle/stand";
import { istKiZweck, istModellKennung } from "@/lib/ki-modelle/zwecke";

/**
 * Die Karte "KI-Modelle" (req-108): GET liefert je Zweck die Wahl des
 * Accounts und die Modelle, die der Dienst nennt; PUT setzt eine Wahl oder
 * hebt sie auf.
 *
 * Die Kataloge erfragt der Server, mit dem Schluessel des Accounts -- der
 * verlaesst ihn nicht (req-028). Waehlen darf nur ein Account-Admin, wie bei
 * den Zugangsschluesseln: bezahlt wird je Account. Der Account kommt aus der
 * Sitzung, nie aus der Anfrage (req-024).
 */

const KEIN_ZWISCHENSPEICHER = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const felder = await kiModelleStand(getPool(), session.accountId, Date.now());
  return Response.json({ felder }, { headers: KEIN_ZWISCHENSPEICHER });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const body = (await request.json().catch(() => null)) as {
    zweck?: unknown;
    modell?: unknown;
  } | null;
  const zweck = body?.zweck;
  const modell = body?.modell ?? null;
  if (!istKiZweck(zweck) || (modell !== null && !istModellKennung(modell))) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();
  const now = Date.now();
  // Gewaehlt wird aus dem, was der Dienst nennt -- ein Modell, das nicht zur
  // Wahl steht, wird nicht gespeichert. Ist die Liste nicht zu holen, wird
  // nicht gespeichert: ob das Modell lebt, waere nicht zu sagen.
  if (modell !== null) {
    const feld = (await kiModelleStand(db, session.accountId, now)).find(
      (eintrag) => eintrag.zweck === zweck,
    );
    if (!feld?.modelle?.some((eintrag) => eintrag.id === modell)) {
      return Response.json(
        { error: "Dieses Modell nennt der Dienst nicht zur Wahl." },
        { status: 409 },
      );
    }
  }

  await saveAccountKiModell(db, session.accountId, zweck, modell, new Date());
  const felder = await kiModelleStand(db, session.accountId, now);
  return Response.json({ felder }, { headers: KEIN_ZWISCHENSPEICHER });
}
