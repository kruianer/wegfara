"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import { participantDisplayName } from "@/lib/participants/display-name";
import { removeFromTrip } from "@/lib/trip-participants/save-trip-participant";
import { TRIP_PARTICIPANT_ERRORS } from "@/lib/trip-participants/rules";
import type { Mitreisender } from "./mitreisende-view";
import styles from "./mitreisende-view.module.css";

/**
 * Die Rueckfrage, bevor eine Person aus der Reise genommen wird -- derselbe
 * Wortlaut wie im Planer (req-021), als Blatt vom unteren Rand, wie die
 * uebrigen Auswahlen des Begleiters. Die Person selbst bleibt am Account.
 */
export function EntfernenDialog({
  trip,
  participant,
  onRemoved,
  onCancel,
}: {
  trip: Trip;
  participant: Mitreisender;
  onRemoved: (participant: Mitreisender) => void;
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
        className={styles.blatt}
        role="alertdialog"
        aria-modal="true"
        aria-label="Aus der Reise entfernen"
      >
        <h2 className={styles.blattTitel}>Aus der Reise entfernen</h2>
        <p className={styles.einladungText}>
          „{participantDisplayName(participant)}“ fährt bei „{trip.title}“ nicht
          mehr mit. Die Person bleibt in der Teilnehmerverwaltung.
        </p>
        {failed && (
          <p
            className={styles.hinweis}
            role="alert"
            data-testid="trip-participant-remove-error"
          >
            {failed}
          </p>
        )}
        <div className={styles.blattAktionen}>
          <button type="button" className={styles.knopf} onClick={onCancel}>
            Abbrechen
          </button>
          <button
            type="button"
            className={`${styles.knopf} ${styles.knopfGefahr}`}
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
