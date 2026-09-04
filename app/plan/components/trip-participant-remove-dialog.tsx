"use client";

import { useState } from "react";
import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import { participantDisplayName } from "@/lib/participants/display-name";
import { removeFromTrip } from "@/lib/trip-participants/save-trip-participant";
import { TRIP_PARTICIPANT_ERRORS } from "@/lib/trip-participants/rules";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage, bevor eine Person aus der Reise genommen wird (req-021).
 * Sie nennt die Person mit ihrem Namen -- mit Nickname, sofern einer
 * hinterlegt ist (req-020) -- und die Reise, um die es geht. Erst nach
 * Bestaetigung wird entfernt.
 *
 * Die Person selbst bleibt am Account: entfernt wird nur die Zuordnung.
 */
export function TripParticipantRemoveDialog({
  trip,
  participant,
  onRemoved,
  onCancel,
}: {
  trip: Trip;
  participant: Participant;
  onRemoved: (participant: Participant) => void;
  onCancel: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function confirm() {
    if (removing) return;
    setRemoving(true);
    setFailed(null);

    const result = await removeFromTrip(trip.id, participant.id);
    setRemoving(false);
    if (!result.ok) {
      setFailed(
        result.reason === "lastLeader"
          ? TRIP_PARTICIPANT_ERRORS.lastLeader
          : TRIP_PARTICIPANT_ERRORS.failed,
      );
      return;
    }
    onRemoved(participant);
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Aus der Reise entfernen"
      >
        <h2 className={styles.title}>Aus der Reise entfernen</h2>
        <p className={styles.text}>
          „{participantDisplayName(participant)}“ fährt bei „{trip.title}“ nicht
          mehr mit. Die Person bleibt in der Teilnehmerverwaltung.
        </p>
        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="trip-participant-remove-error"
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
            disabled={removing}
          >
            {removing ? "Entfernt…" : "Entfernen"}
          </button>
        </div>
      </div>
    </div>
  );
}
