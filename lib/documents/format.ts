/**
 * Die Groesse einer Datei, wie sie auf der Karte steht (Vorlage, Abschnitt
 * "5. Dokumente"): "412 KB", "1,8 MB". Gerechnet wird mit 1024, gezeigt
 * wird mit deutschem Dezimalkomma.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

/**
 * Wann ein Dokument abgelegt wurde, z.B. „04.09.2026“. `createdAt` ist ein
 * Zeitpunkt (timestamptz) und wird in der Zeitzone des Geraets gezeigt --
 * wie das Datum einer Ausgabe (siehe lib/expenses/format.ts).
 */
export function formatDocumentDate(createdAt: string): string {
  const date = new Date(createdAt);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Die Zeile unter dem Namen: „Größe · Datum · Uploader“ (Vorlage,
 * Abschnitt "5. Dokumente"). Ist die Person nicht mehr im Account, bleibt
 * ihr Platz leer statt mit einem erfundenen Namen besetzt.
 */
export function formatDocumentMeta(
  sizeBytes: number,
  createdAt: string,
  uploader: string | null,
): string {
  const parts = [formatFileSize(sizeBytes), formatDocumentDate(createdAt)];
  if (uploader && uploader.trim().length > 0) parts.push(uploader.trim());
  return parts.join(" · ");
}
