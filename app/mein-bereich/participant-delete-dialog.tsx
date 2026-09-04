"use client";

import { useState } from "react";
import type { Participant } from "@/lib/participants/types";
import {
  PARTICIPANT_DELETE_FAILED,
  deleteParticipantRequest,
} from "@/lib/participants/save-participant";
import { participantDisplayName } from "@/lib/participants/display-name";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage vor dem Entfernen einer Person (siehe req-019). Sie nennt
 * die Person so, wie sie in der Oberflaeche heisst -- mit Nickname, sofern
 * einer hinterlegt ist (req-020). Erst nach Bestaetigung wird entfernt.
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
  // Der Grund kommt vom Server: der letzte Bereichs-Admin bleibt (req-038),
  // und das soll die Rueckfrage benennen statt bloss "hat nicht geklappt".
  const [failed, setFailed] = useState<string | null>(null);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setFailed(null);

    const result = await deleteParticipantRequest(participant.id);
    setDeleting(false);
    if (!result.ok) {
      setFailed(result.message || PARTICIPANT_DELETE_FAILED);
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
          „{participantDisplayName(participant)}“ wird aus der Liste der
          Reiseteilnehmer entfernt. Das lässt sich nicht rückgängig machen.
        </p>
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="participant-delete-error"
          >
            {failed}
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
