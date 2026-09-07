"use client";

import { useState } from "react";
import type { Poi } from "@/lib/pois/types";
import { removePois } from "@/lib/pois/save-poi";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage vor dem Aussortieren mehrerer POIs (req-057). Sie nennt,
 * wie viele es sind und welche — mit ihnen verschwinden ihre Bilder und die
 * Angaben aus Google, vollstaendig und ohne Weg zurueck (req-057,
 * Constraints).
 */
export function PoiBulkDeleteDialog({
  pois,
  onDeleted,
  onCancel,
}: {
  /** Die angekreuzten POIs, mindestens einer. */
  pois: Poi[];
  /** Die tatsaechlich entfernten POIs — gespeichert ist das da bereits. */
  onDeleted: (pois: Poi[]) => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setFailed(false);

    const removedIds = await removePois(pois.map((poi) => poi.id));
    setDeleting(false);
    if (!removedIds) {
      setFailed(true);
      return;
    }
    onDeleted(pois.filter((poi) => removedIds.includes(poi.id)));
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Ausgewählte POIs entfernen"
      >
        <h2 className={styles.title}>Ausgewählte POIs entfernen</h2>
        <p className={styles.text}>
          {pois.length === 1 ? "Ein POI wird" : `${pois.length} POIs werden`}{" "}
          mit ihren Bildern und den Angaben aus Google entfernt. Das lässt sich
          nicht rückgängig machen.
        </p>
        <p className={styles.losses} data-testid="poi-bulk-delete-namen">
          {pois.map((poi) => `„${poi.name}“`).join(", ")}
        </p>
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="poi-bulk-delete-error"
          >
            Die POIs konnten nicht entfernt werden.
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
