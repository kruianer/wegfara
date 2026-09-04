import { getPool } from "@/lib/db/pool";
import { findParticipantInAccount } from "@/lib/db/participants";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

/**
 * Die Bankverbindung einer Person -- auf Anforderung, fuer den
 * Ueberweisungscode des Ausgleichs (req-031).
 *
 * Sie wird bewusst nicht mit dem Begleiter ausgeliefert, sondern erst
 * geholt, wenn jemand den Code zu einer Zahlung anfordert: dann geht genau
 * die eine Bankverbindung ueber die Leitung, die gebraucht wird, und keine
 * zweite.
 *
 * Telefonnummer und Bankverbindung sind personenbezogene Daten und nur fuer
 * angemeldete Personen desselben Accounts sichtbar (siehe
 * delivery/security.md): geprueft wird die Sitzung, gefiltert wird nach dem
 * Account aus der Sitzung -- nie nach einem aus der Anfrage (req-024).
 * Hinaus geht allein die Bankverbindung; Name, E-Mail und Telefonnummer
 * bleiben hier -- den Namen hat der Begleiter ohnehin.
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const participantId =
    new URL(request.url).searchParams.get("teilnehmer")?.trim() ?? "";
  if (participantId.length === 0) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const person = await findParticipantInAccount(
    getPool(),
    session.accountId,
    participantId,
  );
  if (!person) return Response.json({ error: "unknown" }, { status: 404 });

  return Response.json({ iban: person.iban });
}
