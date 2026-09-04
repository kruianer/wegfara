"use client";

import { useState } from "react";
import type { Poi } from "@/lib/pois/types";
import { removePoi } from "@/lib/pois/save-poi";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage vor dem Entfernen eines POI (req-035). Sie nennt seinen
 * Namen und, wenn er bereits verplant ist, die Programmpunkte dazu: sie
 * bleiben bestehen und verlieren nur die Verknuepfung.
 */
export function PoiDeleteDialog({
  poi,
  activityTitles,
  onDeleted,
  onCancel,
}: {
  poi: Poi;
  /** Titel der Programmpunkte, die aus diesem POI entstanden sind. */
  activityTitles: string[];
  onDeleted: (poi: Poi) => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setFailed(false);

    const deleted = await removePoi(poi.id);
    setDeleting(false);
    if (!deleted) {
      setFailed(true);
      return;
    }
    onDeleted(poi);
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="POI entfernen"
      >
        <h2 className={styles.title}>POI entfernen</h2>
        <p className={styles.text}>
          „{poi.name}“ wird mit seinen Bildern entfernt. Das lässt sich nicht
          rückgängig machen.
        </p>
        {activityTitles.length > 0 && (
          <p className={styles.losses} data-testid="poi-delete-verplant">
            {poi.name} ist bereits verplant:{" "}
            {activityTitles.map((titel) => `„${titel}“`).join(", ")}.{" "}
            {activityTitles.length === 1
              ? "Der Programmpunkt bleibt bestehen und verliert nur die Verknüpfung."
              : "Die Programmpunkte bleiben bestehen und verlieren nur die Verknüpfung."}
          </p>
        )}
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="poi-delete-error"
          >
            Der POI konnte nicht entfernt werden.
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
