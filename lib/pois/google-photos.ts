import { randomUUID } from "node:crypto";
import type { Queryable } from "@/lib/db/queryable";
import { replacePoiPhotos } from "@/lib/db/poi-photos";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import type { PoiPhoto } from "./types";

/** Woher die Bilder kommen — mehr braucht das Uebernehmen nicht (req-026). */
export interface GooglePhotoSource {
  fetchPhoto(photoName: string): Promise<Uint8Array | null>;
}

/**
 * Laedt die Fotos eines Ortes bei Google herunter, legt sie in der
 * Bildablage ab und schreibt zu jeder Datei ihren Datensatz (siehe
 * stack.md: kein Bild ohne Datensatz, kein Datensatz ohne Datei).
 *
 * Ein Foto, das sich nicht holen laesst, entfaellt fuer sich — der POI
 * bleibt bestehen und zeigt dann die farbige Flaeche seines Typs. Ohne
 * eingerichtetes Bildverzeichnis entfallen alle.
 *
 * Gebraucht wird das an zwei Stellen: beim POI aus einem Google-Maps-Link
 * (req-026) und bei jedem Vorschlag der KI-Suche (req-057).
 */
export async function uebernehmeGoogleFotos(
  db: Queryable,
  poiId: string,
  photoNames: string[],
  google: GooglePhotoSource,
  now: Date = new Date(),
): Promise<PoiPhoto[]> {
  let store;
  try {
    store = fileSystemPhotoStore();
  } catch {
    return [];
  }

  const fileNames: string[] = [];
  for (const photoName of photoNames) {
    const data = await google.fetchPhoto(photoName);
    if (!data) continue;
    const fileName = `${randomUUID()}.jpg`;
    try {
      await store.save(fileName, data);
    } catch {
      continue;
    }
    fileNames.push(fileName);
  }

  const { photos, removedFileNames } = await replacePoiPhotos(
    db,
    poiId,
    fileNames,
    now,
  );
  // Beim Auffrischen abgeloeste Dateien duerfen nicht zurueckbleiben.
  for (const alt of removedFileNames) {
    await store.remove(alt).catch(() => {});
  }
  return photos;
}
