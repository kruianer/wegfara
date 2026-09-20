import { BACKUP_SOURCE_LABEL, type BackupEntry } from "./types";

/**
 * Die Angaben eines Backups, wie sie in der Liste und in der
 * Sicherheitsabfrage stehen (req-053).
 */

const EINHEITEN = ["Bytes", "KB", "MB", "GB", "TB"] as const;

/** Eine Groesse in der groessten Einheit, die noch eine ganze Zahl ergibt. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "–";
  if (bytes < 1024) return `${Math.round(bytes)} Bytes`;

  let wert = bytes;
  let stufe = 0;
  while (wert >= 1024 && stufe < EINHEITEN.length - 1) {
    wert /= 1024;
    stufe += 1;
  }
  const gerundet = wert >= 100 ? Math.round(wert) : Math.round(wert * 10) / 10;
  return `${gerundet.toLocaleString("de-DE")} ${EINHEITEN[stufe]}`;
}

/** Der Zeitpunkt eines Backups: Datum und Uhrzeit, ohne Sekunden. */
export function formatBackupTime(createdAt: string): string {
  const zeitpunkt = new Date(createdAt);
  if (Number.isNaN(zeitpunkt.getTime())) return createdAt;
  return zeitpunkt.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Wie die heruntergeladene Datei heisst (req-071). Sie nennt Umgebung und
 * Zeitpunkt, damit sich zwei Backups auf dem iPad oder in der Cloud nicht
 * verwechseln lassen; die Kennung traegt den Zeitpunkt sekundengenau und ist
 * je Ablage eindeutig -- zwei Dateien bekommen deshalb nie denselben Namen.
 */
export function backupArchivName(entry: {
  id: string;
  environment: string;
}): string {
  const umgebung = entry.environment.replace(/[^A-Za-z0-9-]/g, "") || "backup";
  return `wegfara-backup-${umgebung}-${entry.id}.zip`;
}

/** Zeitpunkt, Herkunft und Groesse in einer Zeile. */
export function formatBackupEntry(entry: BackupEntry): string {
  return `${formatBackupTime(entry.createdAt)} · ${
    BACKUP_SOURCE_LABEL[entry.source]
  } · ${formatBytes(entry.sizeBytes)}`;
}
