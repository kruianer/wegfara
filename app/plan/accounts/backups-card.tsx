"use client";

import { useState } from "react";
import { LOGIN_PATH } from "@/lib/auth/paths";
import {
  backupArchivName,
  formatBackupTime,
  formatBytes,
} from "@/lib/backup/format";
import { backupDownloadApi } from "@/lib/backup/paths";
import {
  BACKUP_ERRORS,
  requestBackupDeletion,
  requestBackupUpload,
  requestNewBackup,
} from "@/lib/backup/request-backups";
import {
  BACKUP_SOURCE_LABEL,
  type BackupEntry,
  type BackupOverview,
} from "@/lib/backup/types";
import { BackupRestoreDialog } from "./backup-restore-dialog";
import styles from "./backups-card.module.css";

export const LOW_SPACE_WARNING =
  "Weniger als 10 GB frei. Alte Backups werden nicht von selbst gelöscht — " +
  "gib von Hand Platz frei.";

/**
 * Die Backups in der "Verwaltung" (req-053) -- sie sieht ausschliesslich der
 * Gesamt-Admin. Je Backup stehen Zeitpunkt, Groesse und Herkunft ("von Hand"
 * oder "vor Deploy"), neueste zuerst; darueber, wie viel Platz die Backups
 * belegen und wie viel frei ist.
 *
 * Was in der Liste steht, entscheidet nach jedem Zugriff der Server: die
 * Schnittstellen antworten mit der aufgefrischten Uebersicht, statt dass die
 * Oberflaeche sie nachzieht.
 */
export function BackupsCard({
  overview: initial,
  navigate = (url: string) => window.location.assign(url),
}: {
  overview: BackupOverview;
  /** Nur fuer den Test -- sonst der Wechsel der Seite im Browser. */
  navigate?: (url: string) => void;
}) {
  const [overview, setOverview] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<BackupEntry | null>(null);

  async function erstellen() {
    setNotice(null);
    setBusy(true);
    const aktuell = await requestNewBackup();
    setBusy(false);

    if (!aktuell) {
      setNotice(BACKUP_ERRORS.create);
      return;
    }
    setOverview(aktuell);
  }

  async function loeschen(entry: BackupEntry) {
    setNotice(null);
    setBusy(true);
    const aktuell = await requestBackupDeletion(entry.id);
    setBusy(false);

    if (!aktuell) {
      setNotice(BACKUP_ERRORS.remove);
      return;
    }
    setOverview(aktuell);
  }

  /**
   * Eine heruntergeladene Datei wieder einspielen (req-071). Passt sie
   * nicht, steht der Grund des Servers hier -- die Liste bleibt dann, wie
   * sie war.
   */
  async function hochladen(datei: File) {
    setNotice(null);
    setBusy(true);
    const ergebnis = await requestBackupUpload(datei);
    setBusy(false);

    if ("fehler" in ergebnis) {
      setNotice(ergebnis.fehler);
      return;
    }
    setOverview(ergebnis.overview);
  }

  const count = overview.entries.length;

  return (
    <section className={styles.card} aria-label="Backups">
      <h2 className={styles.cardTitle}>
        Backups
        <span className={styles.count}>
          {` · ${count} ${count === 1 ? "Backup" : "Backups"}`}
        </span>
      </h2>
      <p className={styles.space} data-testid="backup-space">
        {`Belegt: ${formatBytes(overview.usedBytes)} · Frei auf dem Datenträger: ${formatBytes(
          overview.freeBytes,
        )}`}
      </p>
      {overview.lowSpace && (
        <p
          className={styles.warning}
          role="alert"
          data-testid="backup-low-space"
        >
          {LOW_SPACE_WARNING}
        </p>
      )}

      {count === 0 ? (
        <p className={styles.empty}>Noch kein Backup vorhanden.</p>
      ) : (
        <ul className={styles.list}>
          {overview.entries.map((entry) => {
            const zeitpunkt = formatBackupTime(entry.createdAt);
            return (
              <li key={entry.id} className={styles.item}>
                <div className={styles.row}>
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{zeitpunkt}</div>
                    <p className={styles.meta}>
                      {`${BACKUP_SOURCE_LABEL[entry.source]} · ${formatBytes(
                        entry.sizeBytes,
                      )} · ${entry.environment}`}
                    </p>
                  </div>
                  <div className={styles.rowActions}>
                    {/* Ein gewoehnlicher Link: der Browser laedt die Datei
                        stueckweise herunter, ohne sie vorher im Speicher zu
                        sammeln (req-071). */}
                    <a
                      className={styles.actionLink}
                      href={backupDownloadApi(entry.id)}
                      download={backupArchivName(entry)}
                      aria-label={`Herunterladen: ${zeitpunkt}`}
                    >
                      Herunterladen
                    </a>
                    <button
                      type="button"
                      className={styles.actionButton}
                      aria-label={`Wiederherstellen: ${zeitpunkt}`}
                      disabled={busy}
                      onClick={() => setRestoring(entry)}
                    >
                      Wiederherstellen
                    </button>
                    <button
                      type="button"
                      className={styles.actionButton}
                      aria-label={`Löschen: ${zeitpunkt}`}
                      disabled={busy}
                      onClick={() => void loeschen(entry)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {notice && (
        <p className={styles.notice} role="alert" data-testid="backup-notice">
          {notice}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.addButton}
          disabled={busy}
          onClick={() => void erstellen()}
        >
          {busy ? "Arbeitet…" : "Backup erstellen"}
        </button>

        {/* Die Beschriftung ist zugleich die Schaltflaeche: das Feld selbst
            bleibt unsichtbar, aber mit der Tastatur erreichbar (req-071). */}
        <label className={styles.addButton}>
          Backup hochladen
          <input
            type="file"
            accept=".zip,application/zip"
            className={styles.fileInput}
            disabled={busy}
            onChange={(event) => {
              const datei = event.target.files?.[0];
              // Dieselbe Datei soll sich danach erneut waehlen lassen.
              event.target.value = "";
              if (datei) void hochladen(datei);
            }}
          />
        </label>
      </div>

      {restoring && (
        <BackupRestoreDialog
          backup={restoring}
          environment={overview.environment}
          onCancel={() => setRestoring(null)}
          onRestored={() => {
            setRestoring(null);
            // Die Sitzungen stammen jetzt aus dem Backup -- alle sind
            // abgemeldet und landen auf der Anmeldeseite (req-053).
            navigate(LOGIN_PATH);
          }}
        />
      )}
    </section>
  );
}
