import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { createOpenAiClient } from "@/lib/ai/openai-client";
import { AI_FEHLER_TEXT } from "@/lib/ai/fehler";
import { findPoi } from "@/lib/db/pois";
import { addPoiPhoto } from "@/lib/db/poi-photos";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import {
  KI_BILD_QUELLE,
  kiBildAufforderung,
  kiBildVorlage,
} from "@/lib/pois/ki-bild";
import {
  POI_PHOTO_ERRORS,
  poiPhotoContentType,
  storedPhotoFileName,
} from "@/lib/pois/photo-upload";

/**
 * „Bild erzeugen" zu einem POI (req-072): die KI macht aus Titel und
 * Beschreibung ein Bild, das wie ein hochgeladenes abgelegt wird.
 *
 * Es kostet je Aufruf ueber den Zugangsschluessel des Accounts (req-028) und
 * entsteht deshalb nur auf ausdrueckliches Ausloesen — geprueft wird das
 * hier und nicht nur in der Oberflaeche.
 *
 * Geht es nicht, sagt die Antwort den Grund (bug-021, bug-032) und es bleibt
 * nichts Halbes zurueck: die Datei entsteht erst, wenn das Bild vollstaendig
 * da ist, und wird wieder entfernt, wenn der Datensatz dazu nicht zustande
 * kommt (stack.md).
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    poiId?: unknown;
  } | null;
  const poiId = typeof body?.poiId === "string" ? body.poiId.trim() : "";
  if (poiId.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();
  // Der Mandant kommt aus der Anmeldung (req-024): einen POI eines anderen
  // Accounts gibt es fuer diese Sitzung nicht.
  const poi = await findPoi(db, session.accountId, poiId);
  if (!poi) return Response.json({ error: "unknown poi" }, { status: 404 });

  // Bezahlt wird das Bild vom Account, in dem gearbeitet wird (req-028) --
  // nie ueber den Schluessel der Umgebung.
  const apiKey = await accountApiKey(db, session.accountId, "ki_suche");
  if (!apiKey) {
    return Response.json(
      { error: apiKeyMissingHint("ki_suche") },
      { status: 409 },
    );
  }

  const antwort = await createOpenAiClient({ apiKey }).generateImage(
    kiBildAufforderung(kiBildVorlage(poi)),
  );
  if (!antwort.ok) {
    // Der Grund wird benannt, nicht verschluckt (bug-021, bug-032).
    return Response.json(
      { error: AI_FEHLER_TEXT[antwort.fehler.art] },
      { status: 502 },
    );
  }

  const contentType = poiPhotoContentType(antwort.bild.contentType, "");
  if (!contentType || antwort.bild.data.byteLength === 0) {
    return Response.json({ error: POI_PHOTO_ERRORS.failed }, { status: 502 });
  }

  // Der Ablageort ergibt sich aus einer Zufallskennung und der Art der Datei
  // (req-035) -- hier wie beim Hochladen.
  const fileName = storedPhotoFileName(randomUUID(), contentType);

  let store;
  try {
    store = fileSystemPhotoStore();
    await store.save(fileName, antwort.bild.data);
  } catch {
    return Response.json({ error: POI_PHOTO_ERRORS.failed }, { status: 500 });
  }

  let photos;
  try {
    photos = await addPoiPhoto(
      db,
      session.accountId,
      poiId,
      fileName,
      new Date(),
      KI_BILD_QUELLE,
    );
  } catch {
    photos = null;
  }

  // Ohne Datensatz bliebe die Datei verwaist zurueck (stack.md).
  if (!photos) {
    await store.remove(fileName).catch(() => {});
    return Response.json({ error: POI_PHOTO_ERRORS.failed }, { status: 500 });
  }

  return Response.json({ photos }, { status: 201 });
}
