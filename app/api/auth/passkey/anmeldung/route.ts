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
  writeSessionCookie,
} from "@/lib/auth/cookie-store";
import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import {
  PASSKEY_GRUND,
  passkeyGrundText,
  type PasskeyGrund,
} from "@/lib/auth/passkey-fehler";
import {
  protokolliereErfolg,
  protokolliereFehlschlag,
} from "@/lib/auth/protokoll";

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
  /**
   * Jeder Abbruch nennt seinen Schritt -- in der Antwort wie im Log
   * (req-066). Ein `catch`, der jeden Grund auf denselben Satz abbildet,
   * ist hier ausdruecklich nicht zulaessig: genau daran hing bug-046.
   */
  const failed = (grund: PasskeyGrund, einzelheit?: unknown) => {
    protokolliereFehlschlag("passkey-anmeldung", grund, einzelheit);
    const response = NextResponse.json(
      { grund, error: passkeyGrundText(grund, "anmelden") },
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
    return failed(PASSKEY_GRUND.anfrageUnlesbar);
  }

  const expectedChallenge = await readChallengeCookie();
  if (!expectedChallenge) return failed(PASSKEY_GRUND.aufforderungFehlt);
  if (!body.antwort) return failed(PASSKEY_GRUND.antwortFehlt);

  const db = getPool();
  const antwort = body.antwort as AuthenticationResponseJSON;
  const credential = await findCredentialById(db, antwort.id);
  if (!credential) return failed(PASSKEY_GRUND.passkeyUnbekannt);

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
  } catch (grund) {
    return failed(PASSKEY_GRUND.pruefungFehlgeschlagen, grund);
  }

  if (!verification.verified) return failed(PASSKEY_GRUND.nichtBestaetigt);

  const participant = await findParticipantById(db, credential.participantId);
  if (!participant) return failed(PASSKEY_GRUND.personUnbekannt);

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
  protokolliereErfolg("passkey-anmeldung", participant.id);
  const target = safeRedirectTarget(
    typeof body.weiter === "string" ? body.weiter : null,
  );

  const response = NextResponse.json({ weiter: target });
  clearChallengeCookie(response, secure);
  writeSessionCookie(response, result.token, secure);
  return response;
}
