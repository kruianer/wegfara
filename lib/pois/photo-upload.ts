import { fileExtension } from "@/lib/documents/validate";

/**
 * Was sich als Bild zu einem POI hinzufuegen laesst (req-035). Anders als
 * bei den Dokumenten (req-034) sind es nur Bilder -- eine PDF-Datei ist
 * kein Foto eines Ortes. Die Pruefung liegt hier und wird von der
 * Oberflaeche und der Schnittstelle gemeinsam benutzt; ein Aufruf an der
 * Oberflaeche vorbei kommt daran nicht vorbei.
 */
export const ALLOWED_POI_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export type PoiPhotoContentType = (typeof ALLOWED_POI_PHOTO_TYPES)[number];

/** 20 MB je Datei (req-035). */
export const MAX_POI_PHOTO_BYTES = 20 * 1024 * 1024;

/** Die Gruende, aus denen ein Bild abgewiesen wird -- woertlich als Hinweis. */
export const POI_PHOTO_ERRORS = {
  type: "Nur Bilder lassen sich zu einem POI hinzufügen.",
  size: "Das Bild ist größer als 20 MB.",
  empty: "Das Bild ist leer.",
  failed: "Das Bild konnte nicht hinzugefügt werden.",
} as const;

const TYPE_BY_EXTENSION: Record<string, PoiPhotoContentType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

const EXTENSION_BY_TYPE: Record<PoiPhotoContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function isAllowedPoiPhotoType(
  value: unknown,
): value is PoiPhotoContentType {
  return (
    typeof value === "string" &&
    (ALLOWED_POI_PHOTO_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Die Art des Bildes: was der Browser meldet, sonst die Endung. Liefert
 * null, wenn beides nichts Erlaubtes ergibt -- dann wird es abgewiesen.
 */
export function poiPhotoContentType(
  declared: unknown,
  fileName: string,
): PoiPhotoContentType | null {
  if (isAllowedPoiPhotoType(declared)) return declared;
  return TYPE_BY_EXTENSION[fileExtension(fileName)] ?? null;
}

/** Der Grund, aus dem ein Bild nicht abgelegt wird -- oder null. */
export function poiPhotoUploadProblem(file: {
  name: string;
  type?: string;
  size: number;
}): string | null {
  if (poiPhotoContentType(file.type, file.name) === null) {
    return POI_PHOTO_ERRORS.type;
  }
  if (file.size > MAX_POI_PHOTO_BYTES) return POI_PHOTO_ERRORS.size;
  if (file.size <= 0) return POI_PHOTO_ERRORS.empty;
  return null;
}

/**
 * Der Name, unter dem das Bild in der Ablage liegt: eine Zufallskennung und
 * die Endung seiner Art. Vom hochgeladenen Namen bleibt nichts uebrig
 * (req-035, Constraints) -- sonst liesse sich ueber einen Namen wie `../`
 * ausserhalb des Bildverzeichnisses schreiben.
 */
export function storedPhotoFileName(
  id: string,
  contentType: PoiPhotoContentType,
): string {
  return `${id}.${EXTENSION_BY_TYPE[contentType]}`;
}

/**
 * Womit ein abgelegtes Bild ausgeliefert wird. Die Art steht nicht in der
 * Datenbank, sondern in der Endung des selbst vergebenen Dateinamens; die
 * Fotos aus dem Google-Import (req-026) liegen als `.jpg`.
 */
export function poiPhotoContentTypeOfFileName(fileName: string): string {
  return TYPE_BY_EXTENSION[fileExtension(fileName)] ?? "image/jpeg";
}
