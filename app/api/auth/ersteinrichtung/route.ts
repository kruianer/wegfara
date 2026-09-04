import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getPool } from "@/lib/db/pool";
import {
  bootstrapAvailable,
  bootstrapEmail,
  completeBootstrap,
  isBootstrapParticipantId,
  newBootstrapParticipantId,
} from "@/lib/auth/bootstrap";
import { webAuthnConfig } from "@/lib/auth/webauthn-config";
import { connectionIsSecure } from "@/lib/auth/cookies";
import {
  clearBootstrapCookie,
  clearChallengeCookie,
  readBootstrapCookie,
  readChallengeCookie,
  writeBootstrapCookie,
  writeChallengeCookie,
  writeRecoveryCookie,
  writeSessionCookie,
} from "@/lib/auth/cookie-store";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/redirect-target";
import { PASSKEY_SETUP_FAILED_NOTICE } from "@/lib/auth/messages";
import { RECOVERY_CODES_PATH } from "@/lib/auth/paths";
import { DEFAULT_CREDENTIAL_LABEL } from "@/lib/auth/devices";

export const dynamic = "force-dynamic";

/**
 * Die Ersteinrichtung einer frisch deployten, leeren Umgebung (req-037).
 *
 * Es gibt sie ausschliesslich, solange die Tabelle `participant` leer ist --
 * geprueft in GET und POST, nicht nur in der Anzeige: wer die URL direkt
 * aufruft, kommt danach genauso wenig durch. Mit dem ersten Teilnehmer ist
 * dieser Weg dauerhaft zu.
 */

/** Ohne offene Ersteinrichtung gibt es hier nichts zu holen. */
const CLOSED_MESSAGE = "Die Ersteinrichtung ist abgeschlossen.";

function secureFor(request: Request): boolean {
  return connectionIsSecure(
    request.headers.get("x-forwarded-proto"),
    request.url,
  );
}

export async function GET(request: Request) {
  const db = getPool();
  if (!(await bootstrapAvailable(db))) {
    return NextResponse.json({ error: CLOSED_MESSAGE }, { status: 404 });
  }

  const email = bootstrapEmail();
  const config = webAuthnConfig();
  // Die Person gibt es noch nicht -- ihre Kennung entsteht hier und reist im
  // Cookie mit, damit der Passkey auf demselben Benutzer sitzt wie alle
  // spaeteren desselben Kontos.
  const participantId = newBootstrapParticipantId();

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userID: new TextEncoder().encode(participantId),
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  const response = NextResponse.json(options);
  const secure = secureFor(request);
  writeChallengeCookie(response, options.challenge, secure);
  writeBootstrapCookie(response, participantId, secure);
  return response;
}

/**
 * Nimmt den ersten Passkey entgegen und legt damit in einem Zug Account,
 * Betreiber und Sitzung an. Danach ist er angemeldet, und der
 * Wiederherstellungsweg ueber den Anmeldelink steht ab der ersten Minute.
 */
export async function POST(request: Request) {
  const secure = secureFor(request);
  const failed = (status = 400) => {
    const response = NextResponse.json(
      { error: PASSKEY_SETUP_FAILED_NOTICE },
      { status },
    );
    clearChallengeCookie(response, secure);
    clearBootstrapCookie(response, secure);
    return response;
  };

  const db = getPool();
  if (!(await bootstrapAvailable(db))) {
    return NextResponse.json({ error: CLOSED_MESSAGE }, { status: 404 });
  }

  let body: { antwort?: unknown; bezeichnung?: unknown };
  try {
    body = (await request.json()) as {
      antwort?: unknown;
      bezeichnung?: unknown;
    };
  } catch {
    return failed();
  }

  const expectedChallenge = await readChallengeCookie();
  const participantId = await readBootstrapCookie();
  if (!expectedChallenge || !body.antwort) return failed();
  // Die Kennung kommt aus einem Cookie und damit vom Browser -- sie wird
  // geprueft, bevor sie als Primaerschluessel in die Datenbank geht.
  if (!isBootstrapParticipantId(participantId)) return failed();

  const config = webAuthnConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.antwort as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      requireUserVerification: true,
    });
  } catch {
    return failed();
  }

  if (!verification.verified || !verification.registrationInfo) {
    return failed();
  }

  const { credential } = verification.registrationInfo;
  const label =
    typeof body.bezeichnung === "string" && body.bezeichnung.trim()
      ? body.bezeichnung.trim().slice(0, 60)
      : DEFAULT_CREDENTIAL_LABEL;

  const result = await completeBootstrap(
    db,
    participantId,
    {
      id: credential.id,
      // Nur der oeffentliche Schluessel wird gespeichert.
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? [],
      label,
    },
    new Date(),
  );
  // Zwischen Pruefung und Anlegen ist doch jemand zuvorgekommen.
  if (!result) return failed(404);

  const response = NextResponse.json({
    weiter: result.recoveryCodes
      ? `${RECOVERY_CODES_PATH}?weiter=${encodeURIComponent(DEFAULT_AFTER_LOGIN)}`
      : DEFAULT_AFTER_LOGIN,
  });
  clearChallengeCookie(response, secure);
  clearBootstrapCookie(response, secure);
  writeSessionCookie(response, result.token, secure);
  if (result.recoveryCodes) {
    writeRecoveryCookie(response, result.recoveryCodes, secure);
  }
  return response;
}
