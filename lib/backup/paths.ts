/** Die Adressen der Backups (req-053). */
export const BACKUPS_API = "/api/backups";

export function backupApi(id: string): string {
  return `${BACKUPS_API}/${encodeURIComponent(id)}`;
}

export function backupRestoreApi(id: string): string {
  return `${backupApi(id)}/wiederherstellen`;
}

/**
 * Das Wort, das die Sicherheitsabfrage vor einer Wiederherstellung verlangt
 * (req-053). Ohne es wird nichts wiederhergestellt -- geprueft wird das
 * serverseitig und nicht nur in der Oberflaeche.
 */
export const RESTORE_CONFIRMATION = "wiederherstellen";
