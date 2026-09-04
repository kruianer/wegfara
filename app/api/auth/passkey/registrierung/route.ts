import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { createCredential, listCredentials } from "@/lib/db/credentials";
import { webAuthnConfig } from "@/lib/auth/webauthn-config";
import { connectionIsSecure } from "@/lib/auth/cookies";
import {
  clearChallengeCookie,
  readChallengeCookie,
  writeChallengeCookie,
} from "@/lib/auth/cookie-store";
import { PASSKEY_SETUP_FAILED_NOTICE } from "@/lib/auth/messages";
import {
  DEFAULT_CREDENTIAL_LABEL,
  formatDeviceMoment,
} from "@/lib/auth/devices";

export const dynamic = "force-dynamic";

function secureFor(request: Request): boolean {
  return connectionIsSecure(
    request.headers.get("x-forwarded-proto"),
    request.url,
  );
}

/**
 * Einen Passkey einrichten kann nur, wer bereits angemeldet ist -- die
 * erste Anmeldung laeuft ueber den Anmeldelink (req-016).
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "nicht angemeldet" }, { status: 401 });
  }

  const db = getPool();
  const existing = await listCredentials(db, session.participant.id);
  const config = webAuthnConfig();

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userID: new TextEncoder().encode(session.participant.id),
    userName: session.participant.email ?? session.participant.name,
    userDisplayName: session.participant.name,
    attestationType: "none",
    // Bereits hinterlegte Passkeys ausschliessen, damit dasselbe Geraet
    // nicht zweimal denselben Schluessel anlegt.
    excludeCredentials: existing.map((credential) => ({
      id: credential.id,
    })),
    authenticatorSelection: {
      // Der Passkey muss auf dem Geraet auffindbar sein, sonst koennte
      // die Anmeldeseite ihn nicht ohne Eingabe anbieten.
      residentKey: "required",
      // "required" statt "preferred" (req-037): ein Passkey, der sich ohne
      // Face ID / Touch ID / Windows Hello verwenden laesst, waere nur ein
      // Geraetenachweis und kein Zugangsnachweis.
      userVerification: "required",
    },
  });

  const response = NextResponse.json(options);
  writeChallengeCookie(response, options.challenge, secureFor(request));
  return response;
}

/** Nimmt den neu erzeugten Passkey entgegen und hinterlegt ihn. */
export async function POST(request: Request) {
  const secure = secureFor(request);
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "nicht angemeldet" }, { status: 401 });
  }

  const failed = () => {
    const response = NextResponse.json(
      { error: PASSKEY_SETUP_FAILED_NOTICE },
      { status: 400 },
    );
    clearChallengeCookie(response, secure);
    return response;
  };

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
  if (!expectedChallenge || !body.antwort) return failed();

  const config = webAuthnConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.antwort as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      // Nicht nur angefordert, sondern nachgewiesen verlangt (req-037) --
      // sonst entstuende ein Passkey, der die biometrische Pruefung
      // ueberspringt.
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

  const now = new Date();
  await createCredential(
    getPool(),
    {
      id: credential.id,
      participantId: session.participant.id,
      // Nur der oeffentliche Schluessel wird gespeichert.
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? [],
      label,
    },
    now,
  );

  // Das Datum kommt fertig formatiert zurueck, damit "Meine Geraete" den
  // neuen Eintrag ohne Neuladen genauso zeigt wie die uebrigen (req-037).
  const response = NextResponse.json({
    status: "ok",
    bezeichnung: label,
    hinzugefuegtAm: formatDeviceMoment(now),
  });
  clearChallengeCookie(response, secure);
  return response;
}
