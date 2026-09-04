import { getPool } from "../db/pool";
import { listDocumentFileRefs, type DocumentFileRef } from "../db/documents";
import { fileSystemDocumentStore } from "../images/document-store";
import { runDocumentAudit, type DocumentAuditResult } from "./audit";

/**
 * Der taegliche Lauf, der Datei und Datensatz gegeneinander prueft
 * (req-034). Er haengt an der Anwendung selbst (siehe instrumentation.ts)
 * und braucht keine Einrichtung auf dem Server -- eine vergessene
 * Cron-Zeile waere sonst der wahrscheinlichste Grund, warum die Pruefung
 * nie liefe.
 */
export const DOCUMENT_AUDIT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Der erste Lauf wartet kurz: beim Hochfahren ist die Datenbank noch nicht
 * zwingend erreichbar, und der Start der Anwendung soll nicht daran
 * haengen.
 */
export const DOCUMENT_AUDIT_FIRST_RUN_MS = 60 * 1000;

function meldeVerloreneDateien(missing: DocumentFileRef[]): void {
  // Bewusst eine Meldung im Log statt eines stillen Aufraeumens: hier ist
  // etwas verlorengegangen, und das soll auffallen (req-034).
  console.warn(
    `[dokumente] ${missing.length} Datensatz/Datensaetze ohne Datei: ` +
      missing.map((ref) => `${ref.name} (${ref.id})`).join(", "),
  );
}

/**
 * Ein Lauf der Pruefung gegen die echte Datenbank und die echte Ablage.
 * Wirft nie -- ein fehlgeschlagener Lauf darf den Betrieb nicht stoeren;
 * gemeldet wird er im Log.
 */
export async function auditDocumentsOnce(): Promise<DocumentAuditResult | null> {
  try {
    const store = fileSystemDocumentStore();
    const db = getPool();
    return await runDocumentAudit({
      listFiles: () => store.list(),
      listRefs: () => listDocumentFileRefs(db),
      removeFile: (fileName) => store.remove(fileName),
      report: meldeVerloreneDateien,
    });
  } catch (error) {
    console.warn("[dokumente] Die tägliche Prüfung ist gescheitert:", error);
    return null;
  }
}

/**
 * Startet den taeglichen Lauf. Die Zeitgeber halten den Prozess nicht am
 * Leben (`unref`) -- die Pruefung ist Beiwerk, kein Grund, dass sich der
 * Container nicht beenden laesst.
 */
export function startDocumentAudit(
  run: () => Promise<unknown> = auditDocumentsOnce,
): void {
  const first = setTimeout(() => void run(), DOCUMENT_AUDIT_FIRST_RUN_MS);
  const daily = setInterval(() => void run(), DOCUMENT_AUDIT_INTERVAL_MS);
  first.unref?.();
  daily.unref?.();
}
