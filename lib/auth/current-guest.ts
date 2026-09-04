import { getPool } from "../db/pool";
import { findGuestSessionByToken, touchGuestAccess } from "../db/guest-access";
import type { GuestSession } from "../guests/types";
import { readSessionCookie } from "./cookie-store";

/**
 * Der Server-Anschluss des Gastzugangs (req-038). Ein Gast benutzt dasselbe
 * Cookie wie eine angemeldete Person, aber seine Sitzung liegt in einer
 * eigenen Tabelle: `currentSession()` findet sie nie, und damit weist jede
 * bestehende Schnittstelle einen Gast ab, ohne dass sie ihn kennen muesste.
 *
 * Geprueft wird bei jedem Aufruf, ob der Gastzugang noch gilt -- ein
 * Widerruf und der Ablauf wirken damit sofort, auch mitten in einer
 * laufenden Sitzung.
 */
export async function currentGuest(): Promise<GuestSession | null> {
  const token = await readSessionCookie();
  if (!token) return null;

  const db = getPool();
  const now = new Date();
  const guest = await findGuestSessionByToken(db, token, now);
  if (!guest) return null;

  // "Letzte Verwendung" der Liste (req-038). Geschrieben wird hoechstens
  // einmal je Viertelstunde, nicht bei jedem Seitenaufruf.
  await touchGuestAccess(db, guest.guestAccessId, now);
  return guest;
}
