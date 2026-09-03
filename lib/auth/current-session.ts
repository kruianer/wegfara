import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPool } from "../db/pool";
import {
  deleteSessionById,
  findSessionByToken,
  renewSession,
} from "../db/sessions";
import { shouldRenewSession } from "./lifetime";
import { sessionRemainsValid } from "./session-access";
import { SESSION_COOKIE } from "./cookies";
import { LOGIN_PATH } from "./paths";
import type { Session } from "./types";

/**
 * Der Server-Anschluss der Anmeldung: liest das Sitzungs-Cookie und prueft
 * es gegen die Datenbank. Die middleware entscheidet nur anhand des
 * Vorhandenseins des Cookies -- die belastbare Pruefung passiert hier und
 * damit auf jeder geschuetzten Seite und in jeder Schnittstelle.
 */
export async function currentSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getPool();
  const now = new Date();
  const session = await findSessionByToken(db, token, now);
  if (!session) return null;

  // Die Sitzung verlaengert sich bei Nutzung (req-016).
  if (shouldRenewSession(session.expiresAt, now)) {
    session.expiresAt = await renewSession(db, session.id, now);
  }
  return session;
}

/**
 * Fuer geschuetzte Seiten ohne Reisebezug -- Konto, Einrichten des
 * Passkeys: ohne gueltige Sitzung geht es zur Anmeldeseite.
 *
 * Diese Seiten gelten auch fuer jemanden, der gerade keiner laufenden
 * Reise zugeordnet ist: er muss seinen Passkey einrichten und sich
 * abmelden koennen (req-023).
 */
export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

/**
 * Fuer die Bereiche mit Reisedaten -- Planer und Begleiter. Zusaetzlich zur
 * Sitzung wird geprueft, ob die Person ueberhaupt noch etwas zu tun hat
 * (req-023): ist sie keiner freigegebenen Reise mehr zugeordnet und fuehrt
 * sie keine, endet die Sitzung hier und sie landet auf der Anmeldeseite mit
 * dem Hinweis auf den Grund.
 */
export async function requireTripAccess(): Promise<Session> {
  const session = await currentSession();
  if (!session) redirect(LOGIN_PATH);

  const db = getPool();
  if (!(await sessionRemainsValid(db, session.participant.id))) {
    // Die Sitzung endet wirklich, nicht nur diese Anfrage -- sonst bliebe
    // sie ueber die Schnittstellen weiter benutzbar.
    await deleteSessionById(db, session.id);
    redirect(`${LOGIN_PATH}?fehler=keine-reise`);
  }
  return session;
}
