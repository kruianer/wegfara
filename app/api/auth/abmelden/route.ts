import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { logout } from "@/lib/auth/login";
import { connectionIsSecure } from "@/lib/auth/cookies";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookie-store";

export const dynamic = "force-dynamic";

/**
 * Beendet die Sitzung sofort: die Zeile in der Datenbank verschwindet und
 * das Cookie wird geloescht. Abmelden ist von jeder Seite aus moeglich
 * (req-016).
 */
export async function POST(request: Request) {
  const token = await readSessionCookie();
  if (token) {
    await logout(getPool(), token);
  }

  const response = NextResponse.json({ status: "abgemeldet" });
  clearSessionCookie(
    response,
    connectionIsSecure(request.headers.get("x-forwarded-proto"), request.url),
  );
  return response;
}
