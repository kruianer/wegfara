import { fileExtension, type DocumentContentType } from "./validate";

/**
 * Die Endung, unter der eine Art abgelegt wird. Der Ablageort ergibt sich
 * ausschliesslich daraus und aus einer Zufallskennung -- nie aus dem
 * hochgeladenen Namen (req-034, Constraints): sonst liesse sich ueber einen
 * Namen wie `../` ausserhalb des Verzeichnisses schreiben.
 */
const EXTENSION_BY_TYPE: Record<DocumentContentType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Der Name, unter dem die Datei in der Ablage liegt: die uebergebene
 * Zufallskennung und die Endung ihrer Art. Vom hochgeladenen Namen bleibt
 * nichts uebrig.
 */
export function storedFileName(
  id: string,
  contentType: DocumentContentType,
): string {
  return `${id}.${EXTENSION_BY_TYPE[contentType]}`;
}

/**
 * Das Kuerzel auf dem Dateisymbol der Karte, z.B. "PDF" oder "JPG"
 * (Vorlage, Abschnitt "5. Dokumente"). Es folgt dem angezeigten Namen;
 * fehlt ihm eine Endung, tritt die Art der Datei ein.
 */
export function documentExtensionLabel(
  name: string,
  contentType: string,
): string {
  const fromName = fileExtension(name);
  if (fromName.length > 0) return fromName.toUpperCase().slice(0, 4);
  const fromType = contentType.split("/")[1] ?? "";
  return fromType.length > 0 ? fromType.toUpperCase().slice(0, 4) : "DATEI";
}

/** Ob das Dokument eine PDF-Datei ist -- sie wird anders angezeigt als ein Bild. */
export function isPdf(contentType: string): boolean {
  return contentType === "application/pdf";
}
