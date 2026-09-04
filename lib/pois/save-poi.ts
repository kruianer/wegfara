import type { Poi, PoiPhoto } from "./types";
import type { PoiInput } from "./validate";
import { POI_PHOTO_ERRORS, poiPhotoUploadProblem } from "./photo-upload";

const POIS_API = "/api/pois";
const POI_PHOTOS_API = "/api/poi-fotos";

/**
 * Anlegen, Aendern und Entfernen eines POI von Hand (req-035). Geschickt
 * wird der Formularstand; geprueft und aufgeraeumt wird er serverseitig
 * noch einmal -- die Pruefung im Formular ist die Bequemlichkeit, jene der
 * Schutz.
 *
 * Alle drei liefern null bzw. false, wenn es fehlschlaegt. Die Eingaben
 * bleiben dann stehen: anders als beim Status (siehe save-status.ts) darf
 * ein fehlgeschlagenes Speichern hier nicht stillschweigend verschwinden.
 */

async function poiAntwort(response: Response): Promise<Poi | null> {
  if (!response.ok) return null;
  try {
    return ((await response.json()) as { poi?: Poi }).poi ?? null;
  } catch {
    return null;
  }
}

export async function saveNewPoi(
  tripId: string,
  input: PoiInput,
): Promise<Poi | null> {
  try {
    return await poiAntwort(
      await fetch(POIS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, ...input }),
      }),
    );
  } catch {
    return null;
  }
}

export async function savePoiChanges(
  poiId: string,
  input: PoiInput,
): Promise<Poi | null> {
  try {
    return await poiAntwort(
      await fetch(POIS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: poiId, ...input }),
      }),
    );
  } catch {
    return null;
  }
}

/** Entfernt einen POI samt seinen Bildern (req-035). */
export async function removePoi(poiId: string): Promise<boolean> {
  try {
    const response = await fetch(POIS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: poiId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fotoAntwort(response: Response): Promise<PoiPhoto[] | null> {
  if (!response.ok) return null;
  try {
    return ((await response.json()) as { photos?: PoiPhoto[] }).photos ?? null;
  } catch {
    return null;
  }
}

export type PhotoUploadResult =
  | { ok: true; photos: PoiPhoto[] }
  | { ok: false; error: string };

/**
 * Fuegt einem POI ein Bild hinzu (req-035) -- vom Geraet gewaehlt oder mit
 * der Kamera aufgenommen; fuer die Schnittstelle ist das dasselbe. Liefert
 * die Bilder des POI in ihrer neuen Reihenfolge.
 */
export async function uploadPoiPhoto(
  poiId: string,
  file: File,
): Promise<PhotoUploadResult> {
  const problem = poiPhotoUploadProblem(file);
  if (problem) return { ok: false, error: problem };

  const body = new FormData();
  body.append("poiId", poiId);
  body.append("datei", file);

  let response: Response;
  try {
    response = await fetch(POI_PHOTOS_API, { method: "POST", body });
  } catch {
    return { ok: false, error: POI_PHOTO_ERRORS.failed };
  }

  let payload: { photos?: PoiPhoto[]; error?: string } | null = null;
  try {
    payload = (await response.json()) as {
      photos?: PoiPhoto[];
      error?: string;
    };
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.photos) {
    return { ok: false, error: payload?.error ?? POI_PHOTO_ERRORS.failed };
  }
  return { ok: true, photos: payload.photos };
}

/** Entfernt ein Bild samt seiner Datei (req-035). */
export async function removePoiPhoto(
  photoId: string,
): Promise<PoiPhoto[] | null> {
  try {
    return await fotoAntwort(
      await fetch(POI_PHOTOS_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      }),
    );
  } catch {
    return null;
  }
}

/** Setzt die Reihenfolge der Bilder eines POI (req-035). */
export async function reorderPoiPhotos(
  poiId: string,
  photoIds: string[],
): Promise<PoiPhoto[] | null> {
  try {
    return await fotoAntwort(
      await fetch(POI_PHOTOS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poiId, photoIds }),
      }),
    );
  } catch {
    return null;
  }
}
