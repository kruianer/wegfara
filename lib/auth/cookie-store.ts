import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  BOOTSTRAP_COOKIE,
  CHALLENGE_COOKIE,
  RECOVERY_COOKIE,
  SESSION_COOKIE,
  challengeCookieOptions,
  expiredCookieOptions,
  recoveryCookieOptions,
  sessionCookieOptions,
} from "./cookies";

/**
 * Die Cookies der Anmeldung an einer Stelle gebuendelt, damit kein
 * Aufrufer die Schutzmerkmale (httpOnly, Secure, SameSite) vergisst.
 * Gelesen wird ueber next/headers, geschrieben ausschliesslich auf die
 * Antwort -- nur so ueberleben die Cookies auch eine Weiterleitung.
 */

export async function readSessionCookie(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export function writeSessionCookie(
  response: NextResponse,
  token: string,
  secure: boolean,
): void {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
}

export function clearSessionCookie(
  response: NextResponse,
  secure: boolean,
): void {
  response.cookies.set(SESSION_COOKIE, "", expiredCookieOptions(secure));
}

export function writeChallengeCookie(
  response: NextResponse,
  challenge: string,
  secure: boolean,
): void {
  response.cookies.set(
    CHALLENGE_COOKIE,
    challenge,
    challengeCookieOptions(secure),
  );
}

export async function readChallengeCookie(): Promise<string | null> {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value ?? null;
}

/**
 * Entwertet die WebAuthn-Aufforderung: jede wird genau einmal
 * beantwortet, gleich ob der Versuch geglueckt ist oder nicht.
 */
export function clearChallengeCookie(
  response: NextResponse,
  secure: boolean,
): void {
  response.cookies.set(CHALLENGE_COOKIE, "", expiredCookieOptions(secure));
}

/**
 * Traegt die Kennung des ersten Teilnehmers durch die Ersteinrichtung
 * (req-037): sie wird beim Anfordern der WebAuthn-Aufforderung erzeugt und
 * beim Hinterlegen des Passkeys wieder gebraucht.
 */
export function writeBootstrapCookie(
  response: NextResponse,
  participantId: string,
  secure: boolean,
): void {
  response.cookies.set(
    BOOTSTRAP_COOKIE,
    participantId,
    challengeCookieOptions(secure),
  );
}

export async function readBootstrapCookie(): Promise<string | null> {
  return (await cookies()).get(BOOTSTRAP_COOKIE)?.value ?? null;
}

export function clearBootstrapCookie(
  response: NextResponse,
  secure: boolean,
): void {
  response.cookies.set(BOOTSTRAP_COOKIE, "", expiredCookieOptions(secure));
}

/**
 * Traegt frisch erzeugte Notfallcodes bis zu ihrer einmaligen Anzeige.
 * Sie stehen nicht in der Antwort der Anmeldung, weil der Anmeldelink mit
 * einer Weiterleitung endet und die Codes diese ueberdauern muessen.
 */
export function writeRecoveryCookie(
  response: NextResponse,
  codes: string[],
  secure: boolean,
): void {
  response.cookies.set(
    RECOVERY_COOKIE,
    JSON.stringify(codes),
    recoveryCookieOptions(secure),
  );
}

export async function readRecoveryCookie(): Promise<string[] | null> {
  const raw = (await cookies()).get(RECOVERY_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((code): code is string => typeof code === "string");
  } catch {
    return null;
  }
}

/** Nach dem Abholen sind die Codes weg -- sie werden nur einmal gezeigt. */
export function clearRecoveryCookie(
  response: NextResponse,
  secure: boolean,
): void {
  response.cookies.set(RECOVERY_COOKIE, "", expiredCookieOptions(secure));
}
