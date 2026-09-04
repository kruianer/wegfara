import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { startGuestSession } from "@/lib/db/guest-access";
import { connectionIsSecure } from "@/lib/auth/cookies";
import { writeSessionCookie } from "@/lib/auth/cookie-store";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { appUrl } from "@/lib/auth/webauthn-config";
import { GUEST_AFTER_REDEEM } from "@/lib/guests/paths";

export const dynamic = "force-dynamic";

/**
 * Loest einen Gastlink ein (req-038): ohne Konto, ohne Passkey, ohne
 * Geraete-Einrichtung. Anders als eine Einladung wird der Link dabei nicht
 * verbraucht -- er gilt bis zu seinem Ablauf, laengstens 90 Tage, und ist
 * jederzeit widerrufbar.
 *
 * Ein widerrufener oder abgelaufener Link wird abgewiesen; die Gast-Sitzung,
 * die dabei entsteht, endet nie spaeter als der Gastzugang selbst.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const secure = connectionIsSecure(
    request.headers.get("x-forwarded-proto"),
    request.url,
  );

  // Die Zieladresse stammt aus APP_URL, nicht aus request.url: hinter dem
  // Cloudflare Tunnel ist request.url die interne Adresse des Containers
  // (siehe bug-008).
  const base = appUrl();

  const result = await startGuestSession(getPool(), token, new Date());
  if (!result) {
    return NextResponse.redirect(
      new URL(`${LOGIN_PATH}?fehler=gastzugang`, base),
      303,
    );
  }

  const response = NextResponse.redirect(
    new URL(GUEST_AFTER_REDEEM, base),
    303,
  );
  writeSessionCookie(response, result.token, secure);
  return response;
}
