/**
 * Was abgelegt werden darf (req-034): Bilder und PDF-Dateien, hoechstens
 * 20 MB je Datei. Die Pruefung liegt hier und wird von der Oberflaeche und
 * der Schnittstelle gemeinsam benutzt -- ein Aufruf an der Oberflaeche
 * vorbei kommt daran nicht vorbei.
 */

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export type DocumentContentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

/** 20 MB je Datei (req-034). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** Laenger als das ist kein Name mehr, sondern ein Text. */
export const DOCUMENT_NAME_MAX_LENGTH = 120;

/**
 * Die Gruende, aus denen eine Datei abgewiesen wird. Sie erscheinen
 * woertlich als Hinweis in der Oberflaeche -- abgewiesen ohne Grund waere
 * fuer den Nutzer nicht zu unterscheiden von kaputt.
 */
export const DOCUMENT_ERRORS = {
  type: "Nur Bilder und PDF-Dateien lassen sich ablegen.",
  size: "Die Datei ist größer als 20 MB.",
  empty: "Die Datei ist leer.",
  name: `Der Name darf höchstens ${DOCUMENT_NAME_MAX_LENGTH} Zeichen haben.`,
  failed: "Das Dokument konnte nicht abgelegt werden.",
} as const;

/** Endung → Art, fuer Dateien, deren Art der Browser nicht mitschickt. */
const TYPE_BY_EXTENSION: Record<string, DocumentContentType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

export function isAllowedDocumentType(
  value: unknown,
): value is DocumentContentType {
  return (
    typeof value === "string" &&
    (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

/** Die Endung eines Dateinamens, klein geschrieben, ohne Punkt. */
export function fileExtension(fileName: string): string {
  const bare = fileName.split(/[\\/]/).pop() ?? "";
  const dot = bare.lastIndexOf(".");
  return dot > 0 ? bare.slice(dot + 1).toLowerCase() : "";
}

/**
 * Die Art der Datei: was der Browser meldet, sonst die Endung. Liefert
 * null, wenn beides nichts Erlaubtes ergibt -- dann wird die Datei
 * abgewiesen.
 */
export function documentContentType(
  declared: unknown,
  fileName: string,
): DocumentContentType | null {
  if (isAllowedDocumentType(declared)) return declared;
  return TYPE_BY_EXTENSION[fileExtension(fileName)] ?? null;
}

/**
 * Der Grund, aus dem eine Datei nicht abgelegt wird -- oder null, wenn
 * nichts dagegen spricht.
 */
export function documentUploadProblem(file: {
  name: string;
  type?: string;
  size: number;
}): string | null {
  if (documentContentType(file.type, file.name) === null) {
    return DOCUMENT_ERRORS.type;
  }
  if (file.size > MAX_DOCUMENT_BYTES) return DOCUMENT_ERRORS.size;
  if (file.size <= 0) return DOCUMENT_ERRORS.empty;
  return null;
}

/**
 * Der anzuzeigende Name eines Dokuments. Beim Ablegen ist es der Name der
 * hochgeladenen Datei -- er benennt sie nur, er bestimmt nie den Ablageort
 * (req-034, Constraints). Ein Pfadanteil darin waere schon deshalb sinnlos
 * und wird abgeschnitten.
 */
export function documentName(raw: string): string {
  const bare = (raw.split(/[\\/]/).pop() ?? "").trim();
  return bare.length > 0 ? bare.slice(0, DOCUMENT_NAME_MAX_LENGTH) : "Dokument";
}

/** Ob ein geaenderter Name zulaessig ist (req-034: Aendern betrifft Name und Verknuepfung). */
export function documentNameProblem(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "Ein Name wird gebraucht.";
  if (trimmed.length > DOCUMENT_NAME_MAX_LENGTH) return DOCUMENT_ERRORS.name;
  return null;
}
