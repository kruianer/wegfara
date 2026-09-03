"use client";

import { useState } from "react";
import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import {
  DEFAULT_TRIP_ROLE,
  TRIP_ROLES,
  TRIP_ROLE_LABELS,
  type TripParticipant,
  type TripRole,
} from "@/lib/trip-participants/types";
import {
  TRIP_PARTICIPANT_ERRORS,
  canRemoveFromTrip,
  canSetRole,
  isTripRole,
  roleInTrip,
  withAssignment,
  withoutAssignment,
} from "@/lib/trip-participants/rules";
import { saveTripRole } from "@/lib/trip-participants/save-trip-participant";
import {
  participantDisplayName,
  participantInitials,
} from "@/lib/participants/display-name";
import { TripParticipantRemoveDialog } from "./trip-participant-remove-dialog";
import { PlusIcon, TrashIcon } from "./icons";
import styles from "./einstellungen-view.module.css";

/** Avatar und Name -- in beiden Gruppen der Karte gleich. */
function PersonLabel({ participant }: { participant: Participant }) {
  const displayName = participantDisplayName(participant);
  return (
    <>
      <span className={styles.avatar} aria-hidden="true">
        {participantInitials(displayName)}
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowName}>{displayName}</div>
      </div>
    </>
  );
}

/**
 * Die Karte "Wer faehrt mit" im Bereich "Einstellungen" (req-021). Sie
 * listet die Personen des Accounts und haelt je Person fest, ob sie an der
 * geoeffneten Reise teilnimmt und in welcher Rolle.
 *
 * Die Zuordnung gilt je Reise: ein Wechsel der geoeffneten Reise zeigt
 * deren eigene. Wer nicht mitfaehrt, steht abgesetzt darunter.
 *
 * Die Rolle wird erfasst und angezeigt, schraenkt aber nichts ein -- alle
 * angemeldeten Personen koennen dasselbe tun (req-021).
 */
export function TripParticipantsCard({
  trip,
  participants,
  tripParticipants,
  onChange,
}: {
  /** Die geoeffnete Reise -- nur ihre Zuordnungen zeigt die Karte. */
  trip: Trip;
  /** Alle Personen des Accounts, zugeordnet oder nicht. */
  participants: Participant[];
  /** Die Zuordnungen des Accounts ueber alle Reisen hinweg. */
  tripParticipants: TripParticipant[];
  onChange: (tripParticipants: TripParticipant[]) => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Participant | null>(null);

  function role(participant: Participant): TripRole | null {
    return roleInTrip(tripParticipants, trip.id, participant.id);
  }

  const assigned = participants.filter(
    (participant) => role(participant) !== null,
  );
  const others = participants.filter(
    (participant) => role(participant) === null,
  );

  /** Ordnet zu oder aendert die Rolle -- beides derselbe Vorgang (req-021). */
  async function setRole(participant: Participant, next: TripRole) {
    setNotice(null);
    // Der letzte Reiseleiter bleibt Reiseleiter. Geprueft wird hier und in
    // der Schnittstelle mit derselben Regel.
    if (!canSetRole(tripParticipants, trip.id, participant.id, next)) {
      setNotice(TRIP_PARTICIPANT_ERRORS.lastLeader);
      return;
    }

    const result = await saveTripRole(trip.id, participant.id, next);
    if (!result.ok) {
      setNotice(
        result.reason === "lastLeader"
          ? TRIP_PARTICIPANT_ERRORS.lastLeader
          : TRIP_PARTICIPANT_ERRORS.failed,
      );
      return;
    }
    onChange(withAssignment(tripParticipants, trip.id, participant.id, next));
  }

  /** Vor dem Entfernen wird zurueckgefragt -- mit dem Namen der Person. */
  function askRemove(participant: Participant) {
    setNotice(null);
    if (!canRemoveFromTrip(tripParticipants, trip.id, participant.id)) {
      setNotice(TRIP_PARTICIPANT_ERRORS.lastLeader);
      return;
    }
    setRemoving(participant);
  }

  const count = assigned.length;

  return (
    <section className={styles.card} aria-label="Wer fährt mit">
      <h2 className={styles.cardTitle}>
        Wer fährt mit
        <span className={styles.count}>
          {` · ${count} ${count === 1 ? "Person" : "Personen"}`}
        </span>
      </h2>

      <ul className={styles.list}>
        {assigned.map((participant) => {
          const displayName = participantDisplayName(participant);
          return (
            <li key={participant.id} className={styles.item}>
              <div className={styles.row}>
                <PersonLabel participant={participant} />
                <select
                  className={styles.roleSelect}
                  aria-label={`Rolle: ${displayName}`}
                  value={role(participant) ?? DEFAULT_TRIP_ROLE}
                  onChange={(event) => {
                    const chosen = event.target.value;
                    if (isTripRole(chosen)) void setRole(participant, chosen);
                  }}
                >
                  {TRIP_ROLES.map((option) => (
                    <option key={option} value={option}>
                      {TRIP_ROLE_LABELS[option]}
                    </option>
                  ))}
                </select>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.danger}`}
                    aria-label={`Aus der Reise entfernen: ${displayName}`}
                    onClick={() => askRemove(participant)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {count === 0 && (
        <p className={styles.emptyHint}>
          Für diese Reise ist noch niemand eingeteilt.
        </p>
      )}

      {notice && (
        <p
          className={styles.notice}
          role="alert"
          data-testid="trip-participant-notice"
        >
          {notice}
        </p>
      )}

      {/* Wer nicht mitfaehrt, steht abgesetzt unter den Zugeordneten
          (req-021, GUI). */}
      {others.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Fährt nicht mit</h3>
          <ul className={styles.list}>
            {others.map((participant) => {
              const displayName = participantDisplayName(participant);
              return (
                <li key={participant.id} className={styles.item}>
                  <div className={`${styles.row} ${styles.rowMuted}`}>
                    <PersonLabel participant={participant} />
                    <button
                      type="button"
                      className={styles.addRowButton}
                      aria-label={`Zur Reise hinzufügen: ${displayName}`}
                      onClick={() =>
                        void setRole(participant, DEFAULT_TRIP_ROLE)
                      }
                    >
                      <PlusIcon />
                      Mitfahren
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {removing && (
        <TripParticipantRemoveDialog
          trip={trip}
          participant={removing}
          onRemoved={(participant) => {
            onChange(
              withoutAssignment(tripParticipants, trip.id, participant.id),
            );
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
