import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { redeemAccessLink } from "@/lib/auth/login";
import { connectionIsSecure } from "@/lib/auth/cookies";
import {
  writeRecoveryCookie,
  writeSessionCookie,
} from "@/lib/auth/cookie-store";
import {
  INVITATION_PASSKEY_PATH,
  LOGIN_PATH,
  RECOVERY_CODES_PATH,
} from "@/lib/auth/paths";
import { appUrl } from "@/lib/auth/webauthn-config";

export const dynamic = "force-dynamic";

/**
 * Loest den Zugangslink einer Einladung ein (req-023). Der Link wird dabei
 * serverseitig entwertet -- ein zweiter Aufruf meldet niemanden mehr an.
 * Danach geht es zum Einrichten des Passkeys; der Link selbst ist kein
 * Dauerzugang.
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

  const result = await redeemAccessLink(getPool(), token, new Date());
  if (!result) {
    return NextResponse.redirect(
      new URL(`${LOGIN_PATH}?fehler=einladung`, base),
      303,
    );
  }

  // Notfallcodes bekommt nur ein Reiseleiter (req-023); fuer ihn werden sie
  // vor dem Passkey genau einmal angezeigt.
  const target = result.recoveryCodes
    ? new URL(
        `${RECOVERY_CODES_PATH}?weiter=${encodeURIComponent(INVITATION_PASSKEY_PATH)}`,
        base,
      )
    : new URL(INVITATION_PASSKEY_PATH, base);

  const response = NextResponse.redirect(target, 303);
  writeSessionCookie(response, result.token, secure);
  if (result.recoveryCodes) {
    writeRecoveryCookie(response, result.recoveryCodes, secure);
  }
  return response;
}
