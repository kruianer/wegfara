import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { redeemLoginLink } from "@/lib/auth/login";
import { connectionIsSecure } from "@/lib/auth/cookies";
import { writeSessionCookie } from "@/lib/auth/cookie-store";
import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import {
  protokolliereErfolg,
  protokolliereFehlschlag,
} from "@/lib/auth/protokoll";
import { LOGIN_PATH } from "@/lib/auth/paths";
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
    // Welcher Schritt fehlschlug, steht im Log (req-066) -- ohne das war
    // von aussen nicht zu unterscheiden, ob der Link fehlte, abgelaufen
    // war oder schon verbraucht.
    protokolliereFehlschlag(
      "anmeldelink-einloesen",
      token ? "link-abgelaufen-oder-verbraucht" : "kein-token",
    );
    return NextResponse.redirect(
      new URL(`${LOGIN_PATH}?fehler=link`, base),
      303,
    );
  }
  protokolliereErfolg("anmeldelink-einloesen", result.session.participant.id);

  const response = NextResponse.redirect(new URL(weiter, base), 303);
  writeSessionCookie(response, result.token, secure);
  return response;
}
