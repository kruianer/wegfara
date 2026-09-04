/**
 * Wird von Next.js einmal beim Hochfahren des Servers aufgerufen.
 *
 * Hier haengt der taegliche Lauf, der Dokument-Dateien und -Datensaetze
 * gegeneinander prueft (req-034). Er gehoert bewusst in die Anwendung und
 * nicht in eine Cron-Zeile auf dem Server: eine vergessene Einrichtung
 * waere sonst der wahrscheinlichste Grund, warum die Pruefung nie liefe.
 */
export async function register() {
  // Nur im Node-Server, nicht in der Edge-Laufzeit -- dort gibt es weder
  // Datenbank noch Dateisystem.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startDocumentAudit } = await import("./lib/documents/daily-audit");
  startDocumentAudit();
}
