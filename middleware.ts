import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  connectionIsSecure,
  sessionCookieOptions,
} from "@/lib/auth/cookies";
import { loginUrlFor } from "@/lib/auth/redirect-target";

/**
 * Alle Bereiche ausser der Startseite setzen eine angemeldete Person
 * voraus (req-016). Oeffentlich bleiben nur:
 * - die Startseite,
 * - die Anmeldeseite samt Einloesen des Anmeldelinks,
 * - die Schnittstellen der Anmeldung selbst (sie pruefen ihre eigenen
 *   Voraussetzungen),
 * - der Health-Endpunkt, den der Container-Betrieb braucht.
 */
const PUBLIC_PATHS = ["/", "/api/health"];
const PUBLIC_PREFIXES = ["/anmeldung", "/api/auth"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Die middleware ist die grobe Absicherung: sie kennt die Datenbank nicht
 * und prueft deshalb nur, ob ueberhaupt ein Sitzungs-Cookie vorliegt. Ob
 * die Sitzung gueltig ist, entscheidet lib/auth/current-session.ts auf der
 * Seite bzw. in der Schnittstelle selbst.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const secure = connectionIsSecure(
    request.headers.get("x-forwarded-proto"),
    request.url,
  );

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "nicht angemeldet" }, { status: 401 });
    }
    const target = new URL(loginUrlFor(`${pathname}${search}`), request.url);
    return NextResponse.redirect(target);
  }

  // Die Sitzung verlaengert sich bei Nutzung -- das gilt auch fuer die
  // Laufzeit des Cookies im Browser (req-016).
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
  return response;
}

export const config = {
  matcher: [
    // Alles ausser den Auslieferungspfaden von Next und statischen Dateien.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest|txt|xml)$).*)",
  ],
};
