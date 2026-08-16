import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPool } from "../db/pool";
import { findSessionByToken, renewSession } from "../db/sessions";
import { shouldRenewSession } from "./lifetime";
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
 * Fuer geschuetzte Seiten: ohne gueltige Sitzung geht es zur Anmeldeseite.
 */
export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}
