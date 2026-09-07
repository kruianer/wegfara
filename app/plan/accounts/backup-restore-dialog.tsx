"use client";

import { useId, useState } from "react";
import { formatBackupTime, formatBytes } from "@/lib/backup/format";
import { RESTORE_CONFIRMATION } from "@/lib/backup/paths";
import {
  BACKUP_ERRORS,
  requestBackupRestore,
} from "@/lib/backup/request-backups";
import { BACKUP_SOURCE_LABEL, type BackupEntry } from "@/lib/backup/types";
import dialogStyles from "@/components/dialog.module.css";
import styles from "./backups-card.module.css";

export const RESTORE_NOT_CONFIRMED = `Bitte „${RESTORE_CONFIRMATION}“ eintippen.`;

/**
 * Die Sicherheitsabfrage vor einer Wiederherstellung (req-053). Sie nennt
 * Zeitpunkt und Herkunft des Backups und verlangt, das Wort
 * "wiederherstellen" einzutippen -- ohne es wird nichts wiederhergestellt.
 *
 * Stammt das Backup aus einer anderen Umgebung, warnt sie ausdruecklich
 * davor. Das ist eine bewusste Abweichung von delivery/devops.md ("dev und
 * prod teilen sich niemals Daten"): sie erlaubt, mit echten Daten auf dev zu
 * pruefen (req-053).
 */
export function BackupRestoreDialog({
  backup,
  environment,
  onRestored,
  onCancel,
}: {
  backup: BackupEntry;
  /** Die Umgebung, in der gerade gearbeitet wird. */
  environment: string;
  onRestored: () => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [wort, setWort] = useState("");
  const [vorherSichern, setVorherSichern] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const fremdeUmgebung = backup.environment !== environment;

  async function bestaetigen() {
    if (busy) return;

    if (wort.trim() !== RESTORE_CONFIRMATION) {
      setFehler(RESTORE_NOT_CONFIRMED);
      return;
    }

    setFehler(null);
    setBusy(true);
    const ok = await requestBackupRestore(backup.id, {
      bestaetigung: RESTORE_CONFIRMATION,
      vorherSichern,
    });
    setBusy(false);

    if (!ok) {
      setFehler(BACKUP_ERRORS.restore);
      return;
    }
    onRestored();
  }

  return (
    <div className={dialogStyles.overlay}>
      <div
        className={dialogStyles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Backup wiederherstellen"
      >
        <h2 className={dialogStyles.title}>Backup wiederherstellen</h2>
        <p className={dialogStyles.text} data-testid="backup-restore-target">
          {`Backup vom ${formatBackupTime(backup.createdAt)} (${
            BACKUP_SOURCE_LABEL[backup.source]
          }, ${formatBytes(backup.sizeBytes)}) wird eingespielt. ` +
            "Datenbank und Bilder werden dabei vollständig ersetzt; " +
            "danach sind alle abgemeldet."}
        </p>

        {fremdeUmgebung && (
          <p
            className={dialogStyles.losses}
            role="alert"
            data-testid="backup-environment-warning"
          >
            {`Achtung: Dieses Backup stammt aus der Umgebung „${backup.environment}“, ` +
              `eingespielt wird es in „${environment}“. Die hinterlegten ` +
              "Zugangsschlüssel sind danach unlesbar und müssen neu gesetzt werden."}
          </p>
        )}

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={vorherSichern}
            onChange={(event) => setVorherSichern(event.target.checked)}
          />
          Vorher den jetzigen Stand sichern
        </label>

        <div className={styles.confirmField}>
          <label className={styles.label} htmlFor={`${fieldId}-wort`}>
            {`Zum Bestätigen „${RESTORE_CONFIRMATION}“ eintippen`}
          </label>
          <input
            id={`${fieldId}-wort`}
            className={styles.input}
            type="text"
            autoComplete="off"
            value={wort}
            onChange={(event) => setWort(event.target.value)}
          />
        </div>

        {fehler && (
          <p
            className={dialogStyles.error}
            role="alert"
            data-testid="backup-restore-error"
          >
            {fehler}
          </p>
        )}

        <div className={dialogStyles.actions}>
          <button
            type="button"
            className={dialogStyles.secondaryButton}
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={dialogStyles.dangerButton}
            disabled={busy}
            onClick={() => void bestaetigen()}
          >
            {busy ? "Stellt wieder her…" : "Wiederherstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}
