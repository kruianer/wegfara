import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { createOpenAiClient } from "@/lib/ai/openai-client";
import { AI_FEHLER_TEXT } from "@/lib/ai/fehler";
import { findTrip } from "@/lib/db/trips";
import { setzeEigenesTitelfoto } from "@/lib/db/trip-titelfoto";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import {
  poiPhotoContentType,
  storedPhotoFileName,
} from "@/lib/pois/photo-upload";
import {
  TITELFOTO_FEHLGESCHLAGEN,
  titelbildAufforderung,
} from "@/lib/trips/titelfoto";

/**
 * „Titelbild von der KI erzeugen lassen" (req-103, req-072): aus Titel,
 * Hauptort und Beschreibung der Reise entsteht ein Bild, das als eigenes
 * Titelfoto abgelegt wird -- gekennzeichnet als KI-Bild.
 *
 * Es kostet je Aufruf ueber den Zugangsschluessel des Accounts (req-028) und
 * entsteht nur auf ausdrueckliches Ausloesen. Geht es nicht, sagt die Antwort
 * den Grund (bug-021), und die bisherige Wahl bleibt, wie sie war.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    tripId?: unknown;
  } | null;
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  if (tripId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();
  const trip = await findTrip(db, session.accountId, tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  const apiKey = await accountApiKey(db, session.accountId, "ki_suche");
  if (!apiKey) {
    return Response.json(
      { error: apiKeyMissingHint("ki_suche") },
      { status: 409 },
    );
  }

  const antwort = await createOpenAiClient({ apiKey }).generateImage(
    titelbildAufforderung(trip),
  );
  if (!antwort.ok) {
    return Response.json(
      { error: AI_FEHLER_TEXT[antwort.fehler.art] },
      { status: 502 },
    );
  }

  const contentType = poiPhotoContentType(antwort.bild.contentType, "");
  if (!contentType || antwort.bild.data.byteLength === 0) {
    return Response.json({ error: TITELFOTO_FEHLGESCHLAGEN }, { status: 502 });
  }

  const fileName = storedPhotoFileName(randomUUID(), contentType);

  let store;
  try {
    store = fileSystemPhotoStore();
    await store.save(fileName, antwort.bild.data);
  } catch {
    return Response.json({ error: TITELFOTO_FEHLGESCHLAGEN }, { status: 500 });
  }

  let gesetzt;
  try {
    gesetzt = await setzeEigenesTitelfoto(
      db,
      session.accountId,
      tripId,
      fileName,
      "ki",
      new Date(),
    );
  } catch {
    gesetzt = null;
  }

  if (!gesetzt) {
    await store.remove(fileName).catch(() => {});
    return Response.json({ error: TITELFOTO_FEHLGESCHLAGEN }, { status: 500 });
  }

  if (gesetzt.removedFileName) {
    await store.remove(gesetzt.removedFileName).catch(() => {});
  }
  return Response.json({ titelfoto: gesetzt.titelfoto }, { status: 201 });
}
