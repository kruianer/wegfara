"use client";

import { useState } from "react";
import type { Participant } from "@/lib/participants/types";
import { removeParticipant } from "@/lib/participants/save-participant";
import styles from "./dialog.module.css";

/**
 * Die Rueckfrage vor dem Entfernen einer Person (siehe req-019). Sie nennt
 * deren Namen; erst nach Bestaetigung wird entfernt.
 */
export function ParticipantDeleteDialog({
  participant,
  onDeleted,
  onCancel,
}: {
  participant: Participant;
  onDeleted: (participant: Participant) => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setFailed(false);

    const deleted = await removeParticipant(participant.id);
    setDeleting(false);
    if (!deleted) {
      setFailed(true);
      return;
    }
    onDeleted(participant);
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Teilnehmer entfernen"
      >
        <h2 className={styles.title}>Teilnehmer entfernen</h2>
        <p className={styles.text}>
          „{participant.name}“ wird aus der Liste der Reiseteilnehmer entfernt.
          Das lässt sich nicht rückgängig machen.
        </p>
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="participant-delete-error"
          >
            Die Person konnte nicht entfernt werden.
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
