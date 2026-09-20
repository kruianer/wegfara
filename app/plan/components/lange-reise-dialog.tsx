"use client";

import {
  formatReiseLaenge,
  reiseLaengeInTagen,
  UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN,
} from "@/lib/trips/laenge";
import { formatDateRange } from "@/lib/trips/format";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage vor dem Speichern einer ungewoehnlich langen Reise
 * (bug-050). Auf prod war aus zwei Tagen ein Jahr geworden, weil im Kalender
 * die Jahreszahl mitgerutscht war -- gespeichert wurde das stillschweigend,
 * und erst die 367 Reisetage im Planer verrieten es.
 *
 * Die Rueckfrage blockiert nicht: eine wirklich lange Reise laesst sich
 * bestaetigen. Sie soll nur verhindern, dass niemand es merkt.
 */
export function LangeReiseDialog({
  title,
  startDate,
  endDate,
  onConfirm,
  onCancel,
}: {
  /** Der Titel, wie er im Formular steht -- die Reise gibt es evtl. noch nicht. */
  title: string;
  startDate: string;
  endDate: string;
  /** Speichert die Reise trotz ihrer Laenge. */
  onConfirm: () => void;
  /** Zurueck ins Formular, ohne zu speichern. */
  onCancel: () => void;
}) {
  const tage = reiseLaengeInTagen(startDate, endDate);

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Ungewöhnlich lange Reise"
      >
        <h2 className={styles.title}>Ungewöhnlich lange Reise</h2>
        <p className={styles.text}>
          „{title}“ — {formatDateRange({ startDate, endDate })}. Reisen über{" "}
          {UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN} Tage sind selten; meist steht
          beim Beginn oder beim Ende das falsche Jahr.
        </p>
        <p className={styles.hinweis} data-testid="lange-reise-tage">
          Der Planer zeigt dafür {formatReiseLaenge(tage)}.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
          >
            Zeitraum ändern
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onConfirm}
          >
            Trotzdem speichern
          </button>
        </div>
      </div>
    </div>
  );
}
