"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
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
  INVITATION_ERRORS,
  requestInvitation,
} from "@/lib/invitations/request-invitation";
import type { Invitation, InvitationMail } from "@/lib/invitations/types";
import {
  participantDisplayName,
  participantInitials,
} from "@/lib/participants/display-name";
import { begleiterZurReise } from "@/lib/einstieg/ziel";
import type { ThemeId } from "@/lib/theme/types";
import { DEFAULT_THEME_ID, findTheme } from "@/lib/theme/themes";
import { loadThemeId } from "@/lib/theme/storage";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { EinladungPanel } from "./einladung-panel";
import { EntfernenDialog } from "./entfernen-dialog";
import styles from "./mitreisende-view.module.css";
import bildlauf from "@/components/bildlauf.module.css";

/** So viel einer Person, wie "Wer faehrt mit" braucht (siehe page.tsx). */
export type Mitreisender = Pick<
  Participant,
  "id" | "name" | "nickname" | "loginEnabled"
>;

/**
 * "Wer faehrt mit" im Begleiter (req-087) -- dasselbe, was die Karte im
 * Planer kann (req-021, req-023), fuer den schmalen Bildschirm gebaut. Beide
 * Wege rufen dieselben Schnittstellen mit denselben Regeln aus
 * lib/trip-participants/rules.ts; was hier geaendert wird, steht danach auch
 * im Planer.
 *
 * Die Planer-Karte selbst bleibt, wie sie ist: der Begleiter kennt den
 * Planer nicht (siehe delivery/stack.md, Conventions) und ordnet je Person
 * zwei Zeilen statt einer, damit bei 375 px nichts ueber den Rand ragt.
 */
export function MitreisendeView({
  trip,
  participants,
  tripParticipants: initialTripParticipants,
  copyToClipboard,
}: {
  /** Die Reise, die im Begleiter gerade offen ist. */
  trip: Trip;
  /** Alle Personen des Accounts, zugeordnet oder nicht. */
  participants: Mitreisender[];
  /** Die Zuordnungen dieser Reise. */
  tripParticipants: TripParticipant[];
  /** Nur fuer den Test -- sonst die Zwischenablage des Browsers. */
  copyToClipboard?: (text: string) => Promise<void>;
}) {
  const [tripParticipants, setTripParticipants] = useState(
    initialTripParticipants,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{
    invitation: Invitation;
    mail: InvitationMail | null;
  } | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Mitreisender | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  // Dieselbe Farbwelt wie im Begleiter -- erst nach dem Mounten, wie dort
  // (siehe go-view.tsx).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeId(loadThemeId());
  }, []);

  function role(participant: Mitreisender): TripRole | null {
    return roleInTrip(tripParticipants, trip.id, participant.id);
  }

  const assigned = participants.filter(
    (participant) => role(participant) !== null,
  );
  const others = participants.filter(
    (participant) => role(participant) === null,
  );
  const count = assigned.length;

  /** Ordnet zu oder aendert die Rolle -- beides derselbe Vorgang (req-021). */
  async function setRole(participant: Mitreisender, next: TripRole) {
    setNotice(null);
    // Der letzte Reiseleiter bleibt Reiseleiter -- geprueft hier und in der
    // Schnittstelle mit derselben Regel wie im Planer.
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
    setTripParticipants((prev) =>
      withAssignment(prev, trip.id, participant.id, next),
    );
  }

  /** Eine neue Einladung entwertet die vorherige (req-023). */
  async function invite(participant: Mitreisender) {
    setNotice(null);
    setInvitation(null);
    setInviting(participant.id);
    const result = await requestInvitation(participant.id);
    setInviting(null);

    if (!result.ok) {
      setNotice(INVITATION_ERRORS.failed);
      return;
    }
    setInvitation({ invitation: result.invitation, mail: result.mail });
  }

  /** Vor dem Entfernen wird zurueckgefragt -- mit dem Namen der Person. */
  function askRemove(participant: Mitreisender) {
    setNotice(null);
    if (!canRemoveFromTrip(tripParticipants, trip.id, participant.id)) {
      setNotice(TRIP_PARTICIPANT_ERRORS.lastLeader);
      return;
    }
    setRemoving(participant);
  }

  return (
    <div
      className={styles.seite}
      style={findTheme(themeId).vars as CSSProperties}
    >
      <header className={styles.kopf}>
        <Link className={styles.zurueck} href={begleiterZurReise(trip.id)}>
          <span aria-hidden="true">‹</span> Zurück
        </Link>
        <div className={styles.kopfText}>
          <h1 className={styles.titel}>Wer fährt mit</h1>
          <p className={styles.reise}>{trip.title}</p>
        </div>
      </header>

      <main className={`${styles.inhalt} ${bildlauf.bildlauf}`}>
        <section aria-label="Wer fährt mit">
          <h2 className={styles.gruppenTitel}>
            {`${count} ${count === 1 ? "Person" : "Personen"}`}
          </h2>

          {notice && (
            <p
              className={styles.hinweis}
              role="alert"
              data-testid="trip-participant-notice"
            >
              {notice}
            </p>
          )}

          <ul className={styles.liste}>
            {assigned.map((participant) => {
              const displayName = participantDisplayName(participant);
              return (
                <li
                  key={participant.id}
                  className={styles.person}
                  data-testid="mitreisender"
                >
                  <div className={styles.personKopf}>
                    <span className={styles.avatar} aria-hidden="true">
                      {participantInitials(displayName)}
                    </span>
                    <span className={styles.name}>{displayName}</span>
                    {/* Zugang hat, wer eine Einladung eingeloest hat
                        (req-023). */}
                    <span
                      className={
                        participant.loginEnabled
                          ? styles.zugang
                          : `${styles.zugang} ${styles.keinZugang}`
                      }
                    >
                      {participant.loginEnabled ? "Zugang" : "Kein Zugang"}
                    </span>
                  </div>
                  <div className={styles.personAktionen}>
                    <select
                      className={styles.rolle}
                      aria-label={`Rolle: ${displayName}`}
                      value={role(participant) ?? DEFAULT_TRIP_ROLE}
                      onChange={(event) => {
                        const chosen = event.target.value;
                        if (isTripRole(chosen)) {
                          void setRole(participant, chosen);
                        }
                      }}
                    >
                      {TRIP_ROLES.map((option) => (
                        <option key={option} value={option}>
                          {TRIP_ROLE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.einladen}
                      aria-label={`Einladen: ${displayName}`}
                      disabled={inviting !== null}
                      onClick={() => void invite(participant)}
                    >
                      Einladen
                    </button>
                    <button
                      type="button"
                      className={styles.entfernen}
                      aria-label={`Aus der Reise entfernen: ${displayName}`}
                      onClick={() => askRemove(participant)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  {invitation?.invitation.participantId === participant.id && (
                    <EinladungPanel
                      invitation={invitation.invitation}
                      mail={invitation.mail}
                      name={displayName}
                      onClose={() => setInvitation(null)}
                      copyToClipboard={copyToClipboard}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {count === 0 && (
            <p className={styles.leer}>
              Für diese Reise ist noch niemand eingeteilt.
            </p>
          )}
        </section>

        {/* Wer zum Account gehoert, aber nicht mitfaehrt, steht abgesetzt
            darunter -- wie in der Planer-Karte (req-021). Neue Personen
            entstehen in "Mein Bereich", nicht hier (req-087, Out of
            Scope). */}
        {others.length > 0 && (
          <section className={styles.gruppe} aria-label="Fährt nicht mit">
            <h2 className={styles.gruppenTitel}>Fährt nicht mit</h2>
            <ul className={styles.liste}>
              {others.map((participant) => {
                const displayName = participantDisplayName(participant);
                return (
                  <li
                    key={participant.id}
                    className={`${styles.person} ${styles.personAbseits}`}
                  >
                    <div className={styles.personKopf}>
                      <span className={styles.avatar} aria-hidden="true">
                        {participantInitials(displayName)}
                      </span>
                      <span className={styles.name}>{displayName}</span>
                      <button
                        type="button"
                        className={styles.knopf}
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
          </section>
        )}
      </main>

      {removing && (
        <EntfernenDialog
          trip={trip}
          participant={removing}
          onRemoved={(participant) => {
            setTripParticipants((prev) =>
              withoutAssignment(prev, trip.id, participant.id),
            );
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
