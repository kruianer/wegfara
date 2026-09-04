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
 * - das Einloesen einer Einladung (req-023) — wer sie aufruft, ist noch
 *   nicht angemeldet; erst das Einloesen legt die Sitzung an. Der Weg
 *   danach (/einladung/passkey) bleibt geschuetzt,
 * - die Ersteinrichtung einer leeren Umgebung (req-037) — sie existiert nur,
 *   solange die Tabelle `participant` leer ist; das prueft die Seite selbst,
 *   weil die middleware die Datenbank nicht kennt,
 * - die Schnittstellen der Anmeldung selbst (sie pruefen ihre eigenen
 *   Voraussetzungen),
 * - der Health-Endpunkt, den der Container-Betrieb braucht,
 * - der Worker der Kartenbibliothek (bug-013) — eine unveraenderte Kopie
 *   einer offenen Bibliothek, die der Browser als eigene Anfrage laedt.
 */
const PUBLIC_PATHS = ["/", "/api/health", "/einladung", "/ersteinrichtung"];
const PUBLIC_PREFIXES = ["/anmeldung", "/api/auth", "/maplibre"];

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
    return noStore(NextResponse.next());
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return noStore(
        NextResponse.json({ error: "nicht angemeldet" }, { status: 401 }),
      );
    }
    const target = new URL(loginUrlFor(`${pathname}${search}`), request.url);
    return noStore(NextResponse.redirect(target));
  }

  // Die Sitzung verlaengert sich bei Nutzung -- das gilt auch fuer die
  // Laufzeit des Cookies im Browser (req-016).
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
  noStore(response);
  return response;
}

/**
 * Ohne diese Vorgabe legt Cloudflare die HTML-Antworten mit
 * "s-maxage=31536000" ab -- ein Jahr. Nach einem Deploy wurde dadurch
 * weiter die alte Seite ausgeliefert, die auf die alten (als "immutable"
 * markierten) Skripte verweist: neue Staende kamen beim Nutzer nie an
 * (bug-012). Die Dateien unter /_next/static tragen einen Hash im Namen
 * und duerfen weiterhin dauerhaft zwischengespeichert werden -- sie sind
 * vom matcher unten ohnehin ausgenommen.
 */
function noStore(response: NextResponse): NextResponse {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0",
  );
  return response;
}

export const config = {
  matcher: [
    // Alles ausser den Auslieferungspfaden von Next und statischen Dateien.
    // "maplibre/" ist der Worker der Kartenbibliothek (bug-013): eine
    // unveraenderte Kopie einer offenen Bibliothek ohne Nutzerdaten. Laeuft
    // die middleware darueber, traegt die Auslieferung "no-store" und der
    // Browser laedt bei jedem Kartenaufruf ein halbes Megabyte neu.
    "/((?!_next/static|_next/image|favicon.ico|maplibre/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest|txt|xml)$).*)",
  ],
};
