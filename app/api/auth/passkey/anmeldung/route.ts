import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { getPool } from "@/lib/db/pool";
import { beginSession } from "@/lib/auth/login";
import {
  findCredentialById,
  updateCredentialUsage,
} from "@/lib/db/credentials";
import { findParticipantById } from "@/lib/db/participants";
import { webAuthnConfig } from "@/lib/auth/webauthn-config";
import { connectionIsSecure } from "@/lib/auth/cookies";
import {
  clearChallengeCookie,
  readChallengeCookie,
  writeChallengeCookie,
  writeRecoveryCookie,
  writeSessionCookie,
} from "@/lib/auth/cookie-store";
import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { PASSKEY_FAILED_NOTICE } from "@/lib/auth/messages";
import { RECOVERY_CODES_PATH } from "@/lib/auth/paths";

export const dynamic = "force-dynamic";

function secureFor(request: Request): boolean {
  return connectionIsSecure(
    request.headers.get("x-forwarded-proto"),
    request.url,
  );
}

/**
 * Fordert eine WebAuthn-Aufforderung an. Ohne allowCredentials, damit der
 * Browser selbst den passenden Passkey anbietet -- die Anmeldung im
 * Alltag kommt so ohne Eingabe aus (req-016) und die Anmeldeseite ihn per
 * Conditional UI von selbst anbieten kann (req-037).
 */
export async function GET(request: Request) {
  const config = webAuthnConfig();
  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    // "required" statt "preferred" (req-037): sonst gibt ein Geraet den
    // Passkey unter Umstaenden ohne Face ID / Touch ID / Windows Hello frei,
    // und der Schutz waere nur noch die Geraetenaehe.
    userVerification: "required",
  });

  const response = NextResponse.json(options);
  writeChallengeCookie(response, options.challenge, secureFor(request));
  return response;
}

/** Prueft die Antwort des Passkeys und meldet bei Erfolg an. */
export async function POST(request: Request) {
  const secure = secureFor(request);
  const failed = () => {
    const response = NextResponse.json(
      { error: PASSKEY_FAILED_NOTICE },
      { status: 401 },
    );
    // Jede Aufforderung wird genau einmal beantwortet.
    clearChallengeCookie(response, secure);
    return response;
  };

  let body: { antwort?: unknown; weiter?: unknown };
  try {
    body = (await request.json()) as { antwort?: unknown; weiter?: unknown };
  } catch {
    return failed();
  }

  const expectedChallenge = await readChallengeCookie();
  if (!expectedChallenge || !body.antwort) return failed();

  const db = getPool();
  const antwort = body.antwort as AuthenticationResponseJSON;
  const credential = await findCredentialById(db, antwort.id);
  if (!credential) return failed();

  const config = webAuthnConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: antwort,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      // Die biometrische Pruefung wird auch nachgewiesen verlangt, nicht nur
      // angefordert (req-037): ein Geraet, das sie ueberspringt, wird
      // abgelehnt. Der Weg zurueck ist dann der Anmeldelink.
      requireUserVerification: true,
      credential: {
        id: credential.id,
        publicKey: Uint8Array.from(
          Buffer.from(credential.publicKey, "base64url"),
        ),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return failed();
  }

  if (!verification.verified) return failed();

  const participant = await findParticipantById(db, credential.participantId);
  if (!participant) return failed();

  const now = new Date();
  await updateCredentialUsage(
    db,
    credential.id,
    verification.authenticationInfo.newCounter,
    now,
  );

  // Die Sitzung merkt sich ihren Passkey (req-037): wird das Geraet unter
  // "Meine Geraete" entfernt, endet sie mit ihm.
  const result = await beginSession(db, participant, now, credential.id);
  const target = safeRedirectTarget(
    typeof body.weiter === "string" ? body.weiter : null,
  );

  const response = NextResponse.json({
    weiter: result.recoveryCodes
      ? `${RECOVERY_CODES_PATH}?weiter=${encodeURIComponent(target)}`
      : target,
  });
  clearChallengeCookie(response, secure);
  writeSessionCookie(response, result.token, secure);
  if (result.recoveryCodes) {
    writeRecoveryCookie(response, result.recoveryCodes, secure);
  }
  return response;
}
