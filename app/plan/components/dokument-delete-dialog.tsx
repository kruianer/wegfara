"use client";

import { useState } from "react";
import type { TripDocument } from "@/lib/documents/types";
import { removeDocument } from "@/lib/documents/save-document";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage vor dem Entfernen eines Dokuments (req-034). Sie nennt
 * seinen Namen -- entfernt wird erst nach Bestaetigung, und dann
 * verschwinden Datensatz und Datei gemeinsam.
 */
export function DokumentDeleteDialog({
  document,
  onDeleted,
  onCancel,
}: {
  document: TripDocument;
  onDeleted: (document: TripDocument) => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setFailed(false);

    const deleted = await removeDocument(document.id);
    setDeleting(false);
    if (!deleted) {
      setFailed(true);
      return;
    }
    onDeleted(document);
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Dokument entfernen"
      >
        <h2 className={styles.title}>Dokument entfernen</h2>
        <p className={styles.text}>
          „{document.name}“ wird mit seiner Datei entfernt. Das lässt sich nicht
          rückgängig machen.
        </p>
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="dokument-delete-error"
          >
            Das Dokument konnte nicht entfernt werden.
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => void confirm()}
            disabled={deleting}
          >
            {deleting ? "Entfernt…" : "Endgültig entfernen"}
          </button>
        </div>
      </div>
    </div>
  );
}
