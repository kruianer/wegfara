import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { redeemLoginLink } from "@/lib/auth/login";
import { connectionIsSecure } from "@/lib/auth/cookies";
import {
  writeRecoveryCookie,
  writeSessionCookie,
} from "@/lib/auth/cookie-store";
import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { LOGIN_PATH, RECOVERY_CODES_PATH } from "@/lib/auth/paths";
import { appUrl } from "@/lib/auth/webauthn-config";

export const dynamic = "force-dynamic";

/**
 * Loest den Anmeldelink aus der E-Mail ein. Der Link wird dabei
 * serverseitig entwertet -- ein zweiter Aufruf meldet niemanden mehr an
 * (req-016).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const weiter = safeRedirectTarget(url.searchParams.get("weiter"));
  const secure = connectionIsSecure(
    request.headers.get("x-forwarded-proto"),
    request.url,
  );

  // Die Zieladresse stammt aus APP_URL, nicht aus request.url: hinter dem
  // Cloudflare Tunnel ist request.url die interne Adresse des Containers
  // (HOSTNAME=0.0.0.0, PORT=3000) und nicht die vom Nutzer aufgerufene
  // Domain -- die Weiterleitung ginge sonst auf https://0.0.0.0:3000
  // (siehe bug-008). Eine von aussen beeinflussbare Angabe wie der
  // Host-Kopf wird bewusst nicht herangezogen.
  const base = appUrl();

  const result = await redeemLoginLink(getPool(), token, new Date());
  if (!result) {
    return NextResponse.redirect(
      new URL(`${LOGIN_PATH}?fehler=link`, base),
      303,
    );
  }

  // Erste Anmeldung: die Notfallcodes werden genau einmal angezeigt.
  const target = result.recoveryCodes
    ? new URL(
        `${RECOVERY_CODES_PATH}?weiter=${encodeURIComponent(weiter)}`,
        base,
      )
    : new URL(weiter, base);

  const response = NextResponse.redirect(target, 303);
  writeSessionCookie(response, result.token, secure);
  if (result.recoveryCodes) {
    writeRecoveryCookie(response, result.recoveryCodes, secure);
  }
  return response;
}
