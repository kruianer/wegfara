import {
  BACKUPS_API,
  BACKUP_UPLOAD_API,
  backupApi,
  backupRestoreApi,
} from "./paths";
import type { BackupOverview } from "./types";

/** Rueckmeldungen der Oberflaeche, wenn ein Zugriff nicht geklappt hat. */
export const BACKUP_ERRORS = {
  create: "Das Backup konnte nicht erstellt werden.",
  remove: "Das Backup konnte nicht gelöscht werden.",
  restore: "Die Wiederherstellung ist fehlgeschlagen.",
  upload: "Das Backup konnte nicht hochgeladen werden.",
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

/** Der Grund, den der Server genannt hat -- sonst nichts. */
function grundAus(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const fehler = (payload as { error?: unknown }).error;
  return typeof fehler === "string" && fehler.length > 0 ? fehler : null;
}

/**
 * Spielt eine heruntergeladene ZIP-Datei wieder ein (req-071). Passt sie
 * nicht, kommt der Grund vom Server und wird unveraendert gezeigt -- die
 * Oberflaeche denkt sich keinen eigenen aus.
 *
 * Die Datei geht als Rumpf der Anfrage hinaus und nicht als Formular: so
 * reicht der Browser sie durch, ohne sie zu kopieren.
 */
export async function requestBackupUpload(
  datei: Blob,
): Promise<{ overview: BackupOverview } | { fehler: string }> {
  let response: Response;
  try {
    response = await fetch(BACKUP_UPLOAD_API, {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: datei,
    });
  } catch {
    return { fehler: BACKUP_ERRORS.upload };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return { fehler: grundAus(payload) ?? BACKUP_ERRORS.upload };
  }
  if (!isOverview(payload)) return { fehler: BACKUP_ERRORS.upload };
  return { overview: payload };
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
