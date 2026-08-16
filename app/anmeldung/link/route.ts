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

  const result = await redeemLoginLink(getPool(), token, new Date());
  if (!result) {
    return NextResponse.redirect(
      new URL(`${LOGIN_PATH}?fehler=link`, url),
      303,
    );
  }

  // Erste Anmeldung: die Notfallcodes werden genau einmal angezeigt.
  const target = result.recoveryCodes
    ? new URL(
        `${RECOVERY_CODES_PATH}?weiter=${encodeURIComponent(weiter)}`,
        url,
      )
    : new URL(weiter, url);

  const response = NextResponse.redirect(target, 303);
  writeSessionCookie(response, result.token, secure);
  if (result.recoveryCodes) {
    writeRecoveryCookie(response, result.recoveryCodes, secure);
  }
  return response;
}
