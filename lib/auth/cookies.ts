import {
  SESSION_DURATION_MS,
  WEBAUTHN_CHALLENGE_DURATION_MS,
} from "./lifetime";

/** Traegt das Sitzungs-Token; ueberdauert das Schliessen der App (req-016). */
export const SESSION_COOKIE = "wegfara_sitzung";

/** Traegt die WebAuthn-Aufforderung zwischen Anfrage und Antwort. */
export const CHALLENGE_COOKIE = "wegfara_webauthn";

/**
 * Traegt frisch erzeugte Notfallcodes einmalig bis zur Anzeige. Wird beim
 * Abholen sofort geloescht -- die Codes werden nur ein einziges Mal
 * gezeigt (req-016).
 */
export const RECOVERY_COOKIE = "wegfara_notfallcodes";

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict";
  path: string;
  maxAge: number;
}

/**
 * Ausgeliefert wird immer ueber HTTPS (siehe delivery/security.md), aber
 * die Anwendung selbst sieht hinter dem Cloudflare Tunnel eine
 * unverschluesselte Verbindung -- massgeblich ist deshalb der von
 * Cloudflare gesetzte Kopf. Nur die lokale Entwicklung ueber http darf
 * ohne Secure-Flag auskommen, sonst kaeme das Cookie dort nie an.
 */
export function connectionIsSecure(
  forwardedProto: string | null | undefined,
  requestUrl: string,
): boolean {
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  }
  return requestUrl.startsWith("https://");
}

/**
 * SameSite=lax, weil der Anmeldelink aus dem Postfach heraus aufgerufen
 * wird: bei "strict" schickte der Browser das frisch gesetzte Cookie beim
 * anschliessenden Sprung in die Anwendung nicht mit.
 */
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  };
}

export function challengeCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(WEBAUTHN_CHALLENGE_DURATION_MS / 1000),
  };
}

export function recoveryCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(WEBAUTHN_CHALLENGE_DURATION_MS / 1000),
  };
}

/** Loescht ein Cookie, indem es ohne Inhalt und ohne Laufzeit gesetzt wird. */
export function expiredCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
