import { BACKUPS_API, backupApi, backupRestoreApi } from "./paths";
import type { BackupOverview } from "./types";

/** Rueckmeldungen der Oberflaeche, wenn ein Zugriff nicht geklappt hat. */
export const BACKUP_ERRORS = {
  create: "Das Backup konnte nicht erstellt werden.",
  remove: "Das Backup konnte nicht gelöscht werden.",
  restore: "Die Wiederherstellung ist fehlgeschlagen.",
} as const;

function isOverview(value: unknown): value is BackupOverview {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

async function overviewFrom(
  response: Response,
): Promise<BackupOverview | null> {
  if (!response.ok) return null;
  try {
    const payload: unknown = await response.json();
    return isOverview(payload) ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Erstellt ein Backup und liefert die aufgefrischte Liste zurueck. Was in
 * ihr steht, entscheidet der Server -- die Oberflaeche zieht nichts von
 * Hand nach.
 */
export async function requestNewBackup(): Promise<BackupOverview | null> {
  try {
    return await overviewFrom(await fetch(BACKUPS_API, { method: "POST" }));
  } catch {
    return null;
  }
}

export async function requestBackupDeletion(
  id: string,
): Promise<BackupOverview | null> {
  try {
    return await overviewFrom(await fetch(backupApi(id), { method: "DELETE" }));
  } catch {
    return null;
  }
}

/**
 * Stellt ein Backup wieder her (req-053). Das Wort der Sicherheitsabfrage
 * geht mit: der Server prueft es selbst, damit die Bestaetigung nicht nur
 * in der Oberflaeche haengt.
 */
export async function requestBackupRestore(
  id: string,
  options: { bestaetigung: string; vorherSichern: boolean },
): Promise<boolean> {
  try {
    const response = await fetch(backupRestoreApi(id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    return response.ok;
  } catch {
    return false;
  }
}
