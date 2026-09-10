import { getPool } from "@/lib/db/pool";
import { findActivity } from "@/lib/db/activities";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { createOsrmClient } from "@/lib/routing/osrm-client";
import { ermittleRouten, transferVorschlag } from "@/lib/transfers/vorschlag";

/**
 * Der Vorschlag fuer einen Transfer (req-052): Verkehrsmittel, Dauer und
 * Strecke aus der tatsaechlichen Route zwischen zwei Programmpunkten.
 *
 * Er laeuft ueber den Server, wie schon der Live-Status (req-051): der
 * Routing-Dienst kann spaeter auf dem Beelink liegen, wo ihn kein Browser
 * von aussen erreicht. Ohne Vorschlag nennt die Antwort den Grund -- die
 * Oberflaeche zeigt ihn als Hinweis und laesst die Angaben von Hand
 * eintragen.
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const params = new URL(request.url).searchParams;
  const vonId = params.get("von")?.trim() ?? "";
  const nachId = params.get("nach")?.trim() ?? "";
  if (vonId.length === 0 || nachId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const pool = getPool();
  // Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024).
  const [von, nach] = await Promise.all([
    findActivity(pool, session.accountId, vonId),
    findActivity(pool, session.accountId, nachId),
  ]);
  if (!von || !nach) {
    return Response.json({ error: "unknown activity" }, { status: 404 });
  }

  // Fehlt einem der beiden die Position, gibt es keinen Vorschlag; ein
  // Hinweis nennt den Grund (req-052, Funktion).
  if (!von.position || !nach.position) {
    return Response.json({ vorschlag: null, grund: "ohne_position" });
  }

  // Alle drei Profile auf einmal (req-059): wer im Formular das
  // Verkehrsmittel wechselt, bekommt die dafuer gerechnete Dauer ohne neue
  // Anfrage.
  const routen = await ermittleRouten(
    createOsrmClient(),
    von.position,
    nach.position,
  );
  const vorschlag = transferVorschlag(routen);
  // Der Routing-Dienst ist stumm -- dann traegt der Reiseleiter die Angaben
  // selbst ein, statt dass ein erfundener Wert im Formular steht.
  if (!vorschlag) {
    return Response.json({ vorschlag: null, grund: "dienst_stumm" });
  }

  return Response.json({ vorschlag });
}
