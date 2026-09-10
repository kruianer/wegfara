/**
 * Wird von Next.js einmal beim Hochfahren des Servers aufgerufen.
 *
 * Hier haengt der taegliche Lauf, der Dokument-Dateien und -Datensaetze
 * gegeneinander prueft (req-034). Er gehoert bewusst in die Anwendung und
 * nicht in eine Cron-Zeile auf dem Server: eine vergessene Einrichtung
 * waere sonst der wahrscheinlichste Grund, warum die Pruefung nie liefe.
 *
 * Und hier wird die Bildablage angelegt und ausprobiert (bug-027). Beim
 * Start und nicht erst beim ersten Foto: ein Verzeichnis, in das die
 * Anwendung nicht schreiben kann, soll im Protokoll stehen, bevor jemand
 * einen POI aus einem Google-Link anlegt.
 */
export async function register() {
  // Nur im Node-Server, nicht in der Edge-Laufzeit -- dort gibt es weder
  // Datenbank noch Dateisystem.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { bildablageMeldung, pruefeBildablage } = await import(
    "./lib/images/bildablage-pruefung"
  );
  const meldung = bildablageMeldung(await pruefeBildablage());
  // Kein Abbruch: die uebrige Anwendung funktioniert auch ohne Bilder, und
  // ein stehender Server sagt es dem Betreiber ueber /api/health weiter.
  if (meldung) console.error(meldung);

  const { startDocumentAudit } = await import("./lib/documents/daily-audit");
  startDocumentAudit();
}
