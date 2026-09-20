/** Die Adressen der Backups (req-053). */
export const BACKUPS_API = "/api/backups";

export function backupApi(id: string): string {
  return `${BACKUPS_API}/${encodeURIComponent(id)}`;
}

export function backupRestoreApi(id: string): string {
  return `${backupApi(id)}/wiederherstellen`;
}

/**
 * Ein Backup als ZIP herunterladen und eine heruntergeladene Datei wieder
 * hochladen (req-071). Beide Adressen liegen unter /api/backups/ und damit
 * hinter der Anmeldung -- oeffentlich ist allein /api/backups selbst, das
 * der Deploy braucht (siehe middleware.ts).
 */
export function backupDownloadApi(id: string): string {
  return `${backupApi(id)}/herunterladen`;
}

export const BACKUP_UPLOAD_API = `${BACKUPS_API}/hochladen`;

/**
 * Das Wort, das die Sicherheitsabfrage vor einer Wiederherstellung verlangt
 * (req-053). Ohne es wird nichts wiederhergestellt -- geprueft wird das
 * serverseitig und nicht nur in der Oberflaeche.
 */
export const RESTORE_CONFIRMATION = "wiederherstellen";
