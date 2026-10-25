import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { redeemAccessLink } from "@/lib/auth/login";
import { connectionIsSecure } from "@/lib/auth/cookies";
import { writeSessionCookie } from "@/lib/auth/cookie-store";
import { INVITATION_PASSKEY_PATH, LOGIN_PATH } from "@/lib/auth/paths";
import {
  protokolliereErfolg,
  protokolliereFehlschlag,
} from "@/lib/auth/protokoll";
import { appUrl } from "@/lib/auth/webauthn-config";

export const dynamic = "force-dynamic";

/**
 * Loest den Zugangslink einer Einladung ein (req-023). Der Link wird dabei
 * serverseitig entwertet -- ein zweiter Aufruf meldet niemanden mehr an.
 * Danach geht es zum Einrichten des Passkeys; der Link selbst ist kein
 * Dauerzugang.
 *
 * Bis bug-068 geschah das beim blossen Aufruf der Adresse aus dem QR-Code
 * (GET). Dann verbrauchte schon die Link-Vorschau einer QR-App oder eines
 * Messengers die Einladung, und die eingeladene Person landete auf der
 * Anmeldeseite. Jetzt schickt erst die Seite hinter dem QR-Code
 * (app/einladung/page.tsx) das Token per POST hierher.
 */
export async function POST(request: Request) {
  const token = await tokenAus(request);
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
    protokolliereFehlschlag(
      "einladung-einloesen",
      token ? "zugangslink-abgelaufen-oder-verbraucht" : "kein-token",
    );
    return NextResponse.redirect(
      new URL(`${LOGIN_PATH}?fehler=einladung`, base),
      303,
    );
  }
  protokolliereErfolg("einladung-einloesen", result.session.participant.id);

  // Direkt zum Passkey: er entsteht sofort, ohne Zwischenschritt (req-066).
  const response = NextResponse.redirect(
    new URL(INVITATION_PASSKEY_PATH, base),
    303,
  );
  writeSessionCookie(response, result.token, secure);
  return response;
}

/** Das Token kommt als Formularfeld -- ein gewoehnliches HTML-Formular. */
async function tokenAus(request: Request): Promise<string> {
  try {
    const value = (await request.formData()).get("token");
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}
