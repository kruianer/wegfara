import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import {
  erzeugeMitdenkaZugang,
  mitdenkaZugangStand,
  widerrufeMitdenkaZugang,
} from "@/lib/werkzeuge/zugang";

/**
 * Den Zugang fuer mitdenka erzeugen und widerrufen (req-104). Nur ein
 * Account-Admin darf das, geprueft hier serverseitig: ein Schluessel, der
 * alle Reisen des Accounts liest, gehoert nicht in die Hand jedes
 * Teilnehmers.
 *
 * Der Schluessel steht ausschliesslich in der Antwort auf POST -- einmal.
 * Danach gibt ihn keine Schnittstelle mehr heraus, auch kein GET; es gibt
 * nur seine Pruefsumme.
 *
 * Der Account kommt aus der Sitzung und nie aus der Anfrage (req-024).
 */

export async function POST() {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const db = getPool();
  const now = new Date();
  const schluessel = await erzeugeMitdenkaZugang(db, session.accountId, now);
  const stand = await mitdenkaZugangStand(db, session.accountId, now);
  return Response.json({ schluessel, stand });
}

export async function DELETE() {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.accountAdmin) return forbidden();

  const db = getPool();
  await widerrufeMitdenkaZugang(db, session.accountId);
  const stand = await mitdenkaZugangStand(db, session.accountId, new Date());
  return Response.json({ stand });
}
