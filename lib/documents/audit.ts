import type { DocumentFileRef } from "../db/documents";

/**
 * Die taegliche Pruefung von Datei und Datensatz gegeneinander (req-034).
 * Beide Seiten muessen jederzeit zueinander passen; wo sie das nicht tun,
 * sind die beiden Faelle **nicht** gleichwertig:
 *
 * - Eine Datei ohne Datensatz ist wertlos -- niemand kommt an sie heran,
 *   niemand weiss, wozu sie gehoert. Sie wird entfernt.
 * - Ein Datensatz ohne Datei bedeutet, dass etwas verlorengegangen ist. Er
 *   wird **gemeldet, nicht entfernt** -- das soll auffallen, statt still
 *   verschwunden zu sein.
 */
export interface DocumentAuditResult {
  /** Entfernte Dateien ohne Datensatz. */
  removedFiles: string[];
  /** Gemeldete Datensaetze ohne Datei -- sie bleiben stehen. */
  missingFiles: DocumentFileRef[];
}

export interface DocumentAuditDeps {
  /** Die Dateien in der Ablage. */
  listFiles: () => Promise<string[]>;
  /** Die Datensaetze mit ihrem Dateinamen. */
  listRefs: () => Promise<DocumentFileRef[]>;
  removeFile: (fileName: string) => Promise<void>;
  /** Wohin die verlorenen Dateien gemeldet werden. */
  report: (missing: DocumentFileRef[]) => void;
}

/** Was auf welcher Seite fehlt -- ohne etwas anzufassen. */
export function compareDocuments(
  files: string[],
  refs: DocumentFileRef[],
): { orphanFiles: string[]; missingFiles: DocumentFileRef[] } {
  const bekannt = new Set(refs.map((ref) => ref.fileName));
  const vorhanden = new Set(files);
  return {
    orphanFiles: files.filter((file) => !bekannt.has(file)),
    missingFiles: refs.filter((ref) => !vorhanden.has(ref.fileName)),
  };
}

/**
 * Fuehrt die Pruefung aus: entfernt die verwaisten Dateien und meldet die
 * Datensaetze, deren Datei fehlt.
 */
export async function runDocumentAudit(
  deps: DocumentAuditDeps,
): Promise<DocumentAuditResult> {
  const [files, refs] = await Promise.all([deps.listFiles(), deps.listRefs()]);
  const { orphanFiles, missingFiles } = compareDocuments(files, refs);

  const removedFiles: string[] = [];
  for (const file of orphanFiles) {
    await deps.removeFile(file);
    removedFiles.push(file);
  }
  if (missingFiles.length > 0) deps.report(missingFiles);

  return { removedFiles, missingFiles };
}
