"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import { formatTripContents, type TripContents } from "@/lib/trips/format";
import { removeTrip } from "@/lib/trips/save-trip";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage vor dem Loeschen einer Reise (siehe req-017). Sie benennt,
 * was dabei verloren geht; erst nach Bestaetigung wird geloescht.
 */
export function TripDeleteDialog({
  trip,
  contents,
  onDeleted,
  onCancel,
}: {
  trip: Trip;
  contents: TripContents;
  onDeleted: (trip: Trip) => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setFailed(false);

    const deleted = await removeTrip(trip.id);
    setDeleting(false);
    if (!deleted) {
      setFailed(true);
      return;
    }
    onDeleted(trip);
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Reise löschen"
      >
        <h2 className={styles.title}>Reise löschen</h2>
        <p className={styles.text}>
          „{trip.title}“ wird mit allen daran hängenden Daten entfernt. Das
          lässt sich nicht rückgängig machen.
        </p>
        <p className={styles.losses} data-testid="trip-delete-losses">
          Verloren gehen: {formatTripContents(contents)}.
        </p>
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="trip-delete-error"
          >
            Die Reise konnte nicht gelöscht werden.
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
            {deleting ? "Löscht…" : "Endgültig löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}
