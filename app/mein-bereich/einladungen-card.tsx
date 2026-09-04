"use client";

import { useId, useState } from "react";
import type { OpenInvitation } from "@/lib/db/account-users";
import type { Invitation } from "@/lib/invitations/types";
import type { Participant } from "@/lib/participants/types";
import {
  USER_ERRORS,
  inviteUserRequest,
  withdrawInvitationRequest,
} from "@/lib/users/request-users";
import { formatMoment } from "@/lib/users/format";
import type { ParticipantFieldErrors } from "@/lib/participants/validate";
import { InvitationPanel } from "@/components/invitation-panel";
import { PlusIcon } from "@/components/icons";
import styles from "@/components/cards.module.css";

/**
 * Das Formular "Einladen" (req-038): E-Mail-Adresse und Name. Beides ist
 * erforderlich -- ohne Adresse haette die eingeladene Person spaeter keinen
 * Weg zurueck, wenn ihr Geraet verloren geht. Geprueft wird das zusaetzlich
 * serverseitig; das Formular ist die Bequemlichkeit, nicht der Schutz.
 */
function InviteForm({
  onInvited,
  onCancel,
}: {
  onInvited: (
    invitation: Invitation,
    name: string,
    email: string,
    participant: Participant | null,
  ) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ParticipantFieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    const result = await inviteUserRequest({ name, email });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onInvited(result.invitation, name.trim(), email.trim(), result.participant);
    setName("");
    setEmail("");
    setErrors({});
  }

  return (
    <form
      className={styles.form}
      aria-label="Nutzer einladen"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.formFields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-email`}>
            E-Mail-Adresse
          </label>
          <input
            id={`${fieldId}-email`}
            className={styles.input}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email && (
            <p className={styles.error} role="alert">
              {errors.email}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-name`}>
            Name
          </label>
          <input
            id={`${fieldId}-name`}
            className={styles.input}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {errors.name && (
            <p className={styles.error} role="alert">
              {errors.name}
            </p>
          )}
        </div>
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={saving}
        >
          {saving ? "Lädt ein…" : "Einladen"}
        </button>
      </div>
    </form>
  );
}

/**
 * Die Karte "Einladungen" in "Mein Bereich" (req-043). Sie traegt, was bis
 * dahin im Bereich "Nutzer" verteilt war (req-038): den Weg, jemanden
 * hereinzuholen, und die Liste der offenen Einladungen mit ihrem
 * Ablaufdatum samt Zuruecknehmen.
 *
 * Der Zugangslink wird genau einmal gezeigt -- unmittelbar nach dem
 * Erstellen. Danach nie wieder, weil nur seine Pruefsumme gespeichert ist.
 *
 * Die Karte sieht ausschliesslich ein Bereichs-Admin (req-043); dieselbe
 * Pruefung findet noch einmal serverseitig statt (siehe
 * app/api/nutzer/einladungen/route.ts).
 */
export function EinladungenCard({
  invitations: initialInvitations,
  onParticipantInvited = () => {},
}: {
  /** Die offenen Einladungen des Accounts, serverseitig geladen (req-038). */
  invitations: OpenInvitation[];
  /**
   * Die eingeladene Person -- neu angelegt oder die bereits vorhandene mit
   * derselben Adresse. Damit steht sie ohne Neuladen in der Karte
   * "Personen".
   */
  onParticipantInvited?: (participant: Participant) => void;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{
    invitation: Invitation;
    name: string;
  } | null>(null);

  function handleInvited(
    neu: Invitation,
    name: string,
    email: string,
    participant: Participant | null,
  ) {
    setInviting(false);
    setNotice(null);
    setInvitation({ invitation: neu, name });
    // Eine neue Einladung entwertet die vorherige derselben Person
    // (req-023) -- in der Liste steht deshalb genau ein Eintrag je Person.
    setInvitations((current) => [
      ...current.filter((offen) => offen.participantId !== neu.participantId),
      {
        participantId: neu.participantId,
        name: participant?.name ?? name,
        email: participant?.email ?? email,
        expiresAt: neu.expiresAt,
      },
    ]);
    if (participant) onParticipantInvited(participant);
  }

  async function withdraw(open: OpenInvitation) {
    setNotice(null);
    const ok = await withdrawInvitationRequest(open.participantId);
    if (!ok) {
      setNotice(USER_ERRORS.withdrawFailed);
      return;
    }
    setInvitations((current) =>
      current.filter((offen) => offen.participantId !== open.participantId),
    );
  }

  return (
    <section className={styles.card} aria-label="Einladungen">
      <h2 className={styles.cardTitle}>
        Einladungen
        <span className={styles.count}>{` · ${invitations.length} offen`}</span>
      </h2>
      {invitations.length === 0 ? (
        <p className={styles.emptyHint}>Keine offene Einladung.</p>
      ) : (
        <ul className={styles.list}>
          {invitations.map((open) => (
            <li key={open.participantId} className={styles.item}>
              <div className={styles.row}>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>{open.name}</div>
                  <dl className={styles.details}>
                    <div className={styles.detail}>
                      <dt className={styles.detailLabel}>E-Mail-Adresse</dt>
                      <dd className={styles.detailValue}>
                        {open.email ?? "—"}
                      </dd>
                    </div>
                    <div className={styles.detail}>
                      <dt className={styles.detailLabel}>Gültig bis</dt>
                      <dd className={styles.detailValue}>
                        {formatMoment(open.expiresAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    aria-label={`Einladung zurückziehen: ${open.name}`}
                    onClick={() => void withdraw(open)}
                  >
                    Zurückziehen
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <p className={styles.notice} role="alert" data-testid="nutzer-notice">
          {notice}
        </p>
      )}
      {inviting ? (
        <div className={styles.item}>
          <InviteForm
            onInvited={handleInvited}
            onCancel={() => setInviting(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.addButton}
          onClick={() => {
            setInvitation(null);
            setInviting(true);
          }}
        >
          <PlusIcon />
          Einladen
        </button>
      )}
      {/* Genau einmal, unmittelbar nach dem Erstellen (req-038). */}
      {invitation && (
        <InvitationPanel
          invitation={invitation.invitation}
          name={invitation.name}
          onClose={() => setInvitation(null)}
        />
      )}
    </section>
  );
}
