/**
 * Backup und Wiederherstellung (req-053). Ein Backup ist Teil der Anwendung
 * und nicht der Infrastruktur (siehe delivery/stack.md): es sichert
 * Datenbankinhalt und Bilddateien in einem gemeinsamen Lauf, sodass beide
 * Haelften zueinander passen.
 */

/** Woraus ein Backup entstanden ist. */
export type BackupSource = "von_hand" | "vor_deploy";

export const BACKUP_SOURCES: readonly BackupSource[] = [
  "von_hand",
  "vor_deploy",
];

/** Wie die Herkunft in der Oberflaeche heisst (req-053). */
export const BACKUP_SOURCE_LABEL: Record<BackupSource, string> = {
  von_hand: "von Hand",
  vor_deploy: "vor Deploy",
};

export function isBackupSource(value: unknown): value is BackupSource {
  return (
    typeof value === "string" && BACKUP_SOURCES.includes(value as BackupSource)
  );
}

/**
 * Unterhalb dieser Grenze warnt die Liste vor dem knappen Platz (req-053).
 * Geloescht wird deswegen nichts von selbst -- es wird nur gewarnt.
 */
export const LOW_SPACE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

/**
 * Was neben den Daten in einem Backup liegt: wann es entstand, woher es
 * stammt und aus welcher Umgebung. Die Umgebung steht bewusst darin -- ein
 * Backup aus einer anderen laesst sich einspielen, die Sicherheitsabfrage
 * warnt dann ausdruecklich davor (req-053).
 */
export interface BackupManifest {
  /** Aufbau der Ablage; steigt, wenn sich das Format aendert. */
  version: number;
  /** Zeitpunkt des Laufs, ISO-8601. */
  createdAt: string;
  source: BackupSource;
  /** "prod", "dev", "lokal" -- siehe lib/backup/environment.ts. */
  environment: string;
  /** Wie viele Datensaetze gesichert wurden. */
  rowCount: number;
  /** Wie viele Bilddateien gesichert wurden. */
  imageCount: number;
}

/** Ein Eintrag der Liste: das Manifest samt Kennung und Groesse. */
export interface BackupEntry extends BackupManifest {
  id: string;
  sizeBytes: number;
}

/** Was die Liste ueber allen Eintraegen zeigt (req-053). */
export interface BackupOverview {
  /** Die Umgebung, in der die Liste gerade angezeigt wird. */
  environment: string;
  /** Neueste zuerst. */
  entries: BackupEntry[];
  /** Wie viel Platz die Backups zusammen belegen. */
  usedBytes: number;
  /** Wie viel auf dem Datentraeger frei ist. */
  freeBytes: number;
  /** Ob weniger als LOW_SPACE_LIMIT_BYTES frei sind. */
  lowSpace: boolean;
}

export const BACKUP_FORMAT_VERSION = 1;
