const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Die aeussere Frist einer Sitzung: 90 Tage, die sich bei Nutzung
 * verlaengern (req-016). Wie lange jemand tatsaechlich angemeldet bleibt,
 * entscheidet zusaetzlich sein Zustand -- eine Sitzung gilt nur, solange
 * die Person einer freigegebenen Reise zugeordnet ist oder eine Reise
 * fuehrt (req-023, siehe lib/auth/session-access.ts). Das Datum der Reise
 * spielt dabei keine Rolle mehr.
 */
export const SESSION_DURATION_MS = 90 * DAY_MS;

/**
 * Verlaengert wird erst, wenn ein Tag der Laufzeit verbraucht ist. Sonst
 * erzeugte jeder Seitenaufruf einen Schreibvorgang auf der Sitzung.
 */
export const SESSION_RENEWAL_AFTER_MS = 1 * DAY_MS;

/** Ein Anmeldelink ist 15 Minuten gueltig (req-016). */
export const LOGIN_LINK_DURATION_MS = 15 * MINUTE_MS;

/**
 * Ein Zugangslink aus einer Einladung gilt sieben Tage (req-023). Laenger
 * als der Anmeldelink, weil er von Hand weitergegeben wird -- der
 * Reiseleiter scannt ihn ab oder verschickt ihn, und der Eingeladene
 * kommt vielleicht erst am Wochenende dazu.
 */
export const ACCESS_LINK_DURATION_MS = 7 * DAY_MS;

/**
 * Eine WebAuthn-Aufforderung muss zeitnah beantwortet werden; laenger
 * gueltige Aufforderungen erweitern nur das Fenster fuer einen Replay.
 */
export const WEBAUTHN_CHALLENGE_DURATION_MS = 5 * MINUTE_MS;

export function sessionExpiresAt(now: Date): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}

export function loginLinkExpiresAt(now: Date): Date {
  return new Date(now.getTime() + LOGIN_LINK_DURATION_MS);
}

export function accessLinkExpiresAt(now: Date): Date {
  return new Date(now.getTime() + ACCESS_LINK_DURATION_MS);
}

/**
 * True, sobald die Sitzung weit genug abgelaufen ist, dass sich das
 * Verlaengern lohnt.
 */
export function shouldRenewSession(expiresAt: Date, now: Date): boolean {
  const remainingMs = expiresAt.getTime() - now.getTime();
  return remainingMs <= SESSION_DURATION_MS - SESSION_RENEWAL_AFTER_MS;
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
