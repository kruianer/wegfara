import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { deleteCredential, listCredentials } from "@/lib/db/credentials";
import {
  PASSKEY_REMOVAL_MESSAGE,
  passkeyRemovalRefusal,
} from "@/lib/auth/devices";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * Entfernt ein Geraet aus "Meine Geraete" (req-037). Mit dem Passkey enden
 * die Sitzungen, die mit ihm entstanden sind -- wer sein verlorenes iPad
 * entfernt, hat es damit wirklich draussen (siehe lib/db/credentials.ts).
 *
 * Gearbeitet wird ausschliesslich auf den Passkeys der angemeldeten Person:
 * die Kennung kommt aus der Anfrage und darf nie an einen fremden reichen.
 */
export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  let id = "";
  try {
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id === "string") id = body.id;
  } catch {
    id = "";
  }

  const db = getPool();
  const passkeys = await listCredentials(db, session.participant.id);
  const refusal = passkeyRemovalRefusal(
    passkeys,
    id,
    session.participant.email,
  );
  if (refusal) {
    return refusal === "unbekannt"
      ? NextResponse.json(
          { error: PASSKEY_REMOVAL_MESSAGE.unbekannt },
          { status: 404 },
        )
      : NextResponse.json(
          { error: PASSKEY_REMOVAL_MESSAGE.letzterOhneAdresse },
          { status: 409 },
        );
  }

  const entfernt = await deleteCredential(db, session.participant.id, id);
  if (!entfernt) return forbidden();

  return NextResponse.json({ status: "entfernt", id });
}
