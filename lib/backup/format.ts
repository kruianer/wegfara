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

/** Zeitpunkt, Herkunft und Groesse in einer Zeile. */
export function formatBackupEntry(entry: BackupEntry): string {
  return `${formatBackupTime(entry.createdAt)} · ${
    BACKUP_SOURCE_LABEL[entry.source]
  } · ${formatBytes(entry.sizeBytes)}`;
}
