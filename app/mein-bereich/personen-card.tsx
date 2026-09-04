"use client";

import { useId, useState } from "react";
import type { Participant } from "@/lib/participants/types";
import type { AccountUser } from "@/lib/db/account-users";
import {
  PARTICIPANT_NAME_MAX_LENGTH,
  PARTICIPANT_NICKNAME_MAX_LENGTH,
  validateParticipantDraft,
  type ParticipantDraft,
  type ParticipantFieldErrors,
} from "@/lib/participants/validate";
import {
  participantDisplayName,
  participantInitials,
  participantPaymentName,
} from "@/lib/participants/display-name";
import {
  ACCOUNT_ADMIN_ERRORS,
  canSetAccountAdmin,
  promoteAccountAdminWhereMissing,
  withAccountAdmin,
} from "@/lib/participants/account-admin";
import { saveAccountAdmin } from "@/lib/participants/save-account-admin";
import {
  saveNewParticipant,
  saveParticipantChanges,
} from "@/lib/participants/save-participant";
import { formatDay } from "@/lib/users/format";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ParticipantDeleteDialog } from "./participant-delete-dialog";
import styles from "@/components/cards.module.css";

const EMPTY_DRAFT: ParticipantDraft = {
  name: "",
  nickname: "",
  email: "",
  phone: "",
  iban: "",
};

function draftOf(participant: Participant): ParticipantDraft {
  return {
    name: participant.name,
    nickname: participant.nickname ?? "",
    email: participant.email ?? "",
    phone: participant.phone ?? "",
    iban: participant.iban ?? "",
  };
}

/**
 * Das Formular einer Zeile: es legt eine Person an (participant = null)
 * oder aendert eine bestehende (siehe req-019). Gespeichert wird erst auf
 * Knopfdruck; fehlt eine erforderliche Angabe oder ist eine unzulaessig,
 * bleibt die Eingabe stehen und die betroffene Stelle wird benannt.
 */
function ParticipantForm({
  participant,
  onSaved,
  onCancel,
}: {
  participant: Participant | null;
  onSaved: (participant: Participant) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState<ParticipantDraft>(
    participant ? draftOf(participant) : EMPTY_DRAFT,
  );
  const [errors, setErrors] = useState<ParticipantFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  function change(field: keyof ParticipantDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    if (saving) return;

    // Wer sich per Anmeldelink anmeldet, behaelt seine Adresse -- ueber sie
    // laeuft die Anmeldung (siehe delivery/security.md). Zugang ohne Adresse
    // gibt es seit req-023: wer per Einladung hereingekommen ist, braucht
    // keine.
    const found = validateParticipantDraft(draft, {
      emailRequired: Boolean(participant?.loginEnabled && participant.email),
    });
    setErrors(found);
    setFailed(false);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = participant
      ? await saveParticipantChanges(participant.id, draft)
      : await saveNewParticipant(draft);
    setSaving(false);

    if (!result.ok) {
      setErrors(result.errors);
      setFailed(Object.keys(result.errors).length === 0);
      return;
    }
    onSaved(result.participant);
  }

  const heading = participant
    ? `Teilnehmer ändern: ${participantDisplayName(participant)}`
    : "Neuer Teilnehmer";

  const fields: {
    field: keyof ParticipantDraft;
    label: string;
    type: string;
    maxLength?: number;
  }[] = [
    {
      field: "name",
      label: "Name",
      type: "text",
      maxLength: PARTICIPANT_NAME_MAX_LENGTH,
    },
    // Direkt nach dem Namen, im selben Stil wie die uebrigen Felder
    // (req-020). Die Laenge begrenzt schon das Feld selbst -- laenger
    // laesst die Pruefung es ohnehin nicht durch.
    {
      field: "nickname",
      label: "Nickname",
      type: "text",
      maxLength: PARTICIPANT_NICKNAME_MAX_LENGTH,
    },
    { field: "email", label: "E-Mail-Adresse", type: "email" },
    { field: "phone", label: "Telefonnummer", type: "tel" },
    { field: "iban", label: "Bankverbindung (IBAN)", type: "text" },
  ];

  return (
    <form
      className={styles.form}
      aria-label={heading}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.formFields}>
        {fields.map(({ field, label, type, maxLength }) => (
          <div key={field} className={styles.field}>
            <label className={styles.label} htmlFor={`${fieldId}-${field}`}>
              {label}
            </label>
            <input
              id={`${fieldId}-${field}`}
              className={styles.input}
              type={type}
              autoComplete="off"
              maxLength={maxLength}
              value={draft[field]}
              onChange={(event) => change(field, event.target.value)}
            />
            {errors[field] && (
              <p className={styles.error} role="alert">
                {errors[field]}
              </p>
            )}
          </div>
        ))}
      </div>
      {failed && (
        <p
          className={styles.error}
          role="alert"
          data-testid="participant-save-error"
        >
          Die Person konnte nicht gespeichert werden. Die Eingaben bleiben
          stehen.
        </p>
      )}
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
          {saving ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

/**
 * Wann eine Person hinzugekommen ist und wann sie zuletzt hereingekommen
 * ist (req-038). Beides steht nicht an der Person selbst, sondern kommt aus
 * Sitzungen und Passkeys -- deshalb als eigene Angabe je Zeile.
 */
export interface ParticipantActivity {
  joinedAt: string;
  lastSignInAt: string | null;
}

export function activityByParticipant(
  users: AccountUser[],
): Record<string, ParticipantActivity> {
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      { joinedAt: user.joinedAt, lastSignInAt: user.lastSignInAt },
    ]),
  );
}

/** Eine Zeile der Liste in der Anzeige (siehe req-019). */
function ParticipantRow({
  participant,
  activity,
  self,
  onEdit,
  onRemove,
  onToggleAccountAdmin,
}: {
  participant: Participant;
  /** null, solange zu dieser Person noch nichts geladen wurde (req-038). */
  activity: ParticipantActivity | null;
  self: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onToggleAccountAdmin: (accountAdmin: boolean) => void;
}) {
  const details: { label: string; value: string | null }[] = [
    { label: "E-Mail-Adresse", value: participant.email },
    { label: "Telefonnummer", value: participant.phone },
    { label: "Bankverbindung", value: participant.iban },
    // Beitritt und letzte Anmeldung standen bis req-043 im eigenen Bereich
    // "Nutzer"; mit der Zusammenlegung stehen sie in derselben Zeile.
    { label: "Beitritt", value: formatDay(activity?.joinedAt ?? null) },
    {
      label: "Letzte Anmeldung",
      value: formatDay(activity?.lastSignInAt ?? null),
    },
  ];
  const displayName = participantDisplayName(participant);

  return (
    <div className={styles.row}>
      <span className={styles.avatar} aria-hidden="true">
        {participantInitials(displayName)}
      </span>
      <div className={styles.rowBody}>
        {/*
          Die Zeile traegt die Bankverbindung -- hier gilt immer der volle
          Name, damit er zum Kontoinhaber passt (req-020). Der Nickname
          steht als Kurzform daneben.
        */}
        <div className={styles.rowName}>
          {participantPaymentName(participant)}
          {participant.nickname && (
            <span className={styles.nickname}>{participant.nickname}</span>
          )}
          {self && <span className={styles.selfBadge}>Du</span>}
        </div>
        <dl className={styles.details}>
          {details.map(({ label, value }) => (
            <div key={label} className={styles.detail}>
              <dt className={styles.detailLabel}>{label}</dt>
              <dd className={styles.detailValue}>{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      {/* Die Kennzeichnung Bereichs-Admin (im Quelltext weiterhin
          Account-Admin) ist ein umschaltbares Merkmal je Person (req-027,
          Beschriftung seit req-036). */}
      <label
        className={
          participant.accountAdmin
            ? `${styles.adminToggle} ${styles.adminToggleOn}`
            : styles.adminToggle
        }
      >
        <input
          type="checkbox"
          className={styles.adminCheckbox}
          aria-label={`Bereichs-Admin: ${displayName}`}
          checked={participant.accountAdmin}
          onChange={(event) => onToggleAccountAdmin(event.target.checked)}
        />
        Bereichs-Admin
      </label>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Teilnehmer ändern: ${displayName}`}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
        {/* Die eigene Person laesst sich nicht entfernen (req-019). */}
        {!self && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.danger}`}
            aria-label={`Teilnehmer entfernen: ${displayName}`}
            onClick={onRemove}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Die Karte "Personen" in "Mein Bereich" (req-043). Sie fuehrt zusammen,
 * was bis dahin die Karte "Reiseteilnehmer" des Bereichs "Account"
 * (req-019, req-027, req-032) und die Karte "Personen" des Bereichs
 * "Nutzer" (req-038) getrennt gezeigt haben: eine Liste der Personen des
 * Accounts mit Kontaktdaten, Beitritt und letzter Anmeldung, dazu Anlegen,
 * Aendern und Entfernen.
 *
 * Die Liste haengt an keiner Reise -- gefiltert wird hier nie nach einer
 * geoeffneten Reise.
 *
 * Die Karte sieht ausschliesslich ein Bereichs-Admin (req-043); wer die
 * Kennzeichnung nicht traegt, bekommt sie gar nicht erst zu Gesicht.
 * Dieselbe Pruefung findet noch einmal serverseitig statt (siehe
 * app/api/participants/route.ts) -- das Ausblenden ist die Anzeige, nicht
 * der Schutz.
 */
export function PersonenCard({
  participants,
  onParticipantsChange,
  selfParticipantId,
  activity = {},
}: {
  /** Die Personen des Accounts -- nie nach einer Reise gefiltert (req-032). */
  participants: Participant[];
  onParticipantsChange: (participants: Participant[]) => void;
  /** Die angemeldete Person -- sie ist gekennzeichnet und bleibt in der Liste. */
  selfParticipantId: string;
  /** Beitritt und letzte Anmeldung je Person (req-038). */
  activity?: Record<string, ParticipantActivity>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Participant | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSaved(saved: Participant) {
    onParticipantsChange(
      participants.some((person) => person.id === saved.id)
        ? participants.map((person) =>
            person.id === saved.id ? saved : person,
          )
        : [...participants, saved],
    );
    setEditingId(null);
    setAdding(false);
  }

  /**
   * Ernennt eine Person zum Account-Admin oder entzieht ihr die
   * Kennzeichnung (req-027). Der letzte behaelt sie -- geprueft wird hier
   * und in der Schnittstelle mit derselben Regel.
   */
  async function toggleAccountAdmin(participant: Participant, next: boolean) {
    setNotice(null);
    if (!canSetAccountAdmin(participants, participant.id, next)) {
      setNotice(ACCOUNT_ADMIN_ERRORS.lastAdmin);
      return;
    }

    const result = await saveAccountAdmin(participant.id, next);
    if (!result.ok) {
      setNotice(
        result.reason === "lastAdmin"
          ? ACCOUNT_ADMIN_ERRORS.lastAdmin
          : ACCOUNT_ADMIN_ERRORS.failed,
      );
      return;
    }
    onParticipantsChange(withAccountAdmin(participants, participant.id, next));
  }

  function handleDeleted(deleted: Participant) {
    onParticipantsChange(
      // War die Person der letzte Account-Admin, rueckt jemand nach -- nach
      // derselben Regel wie in der Datenbank (req-027, siehe
      // lib/db/participants.ts).
      promoteAccountAdminWhereMissing(
        participants.filter((person) => person.id !== deleted.id),
      ),
    );
    setRemoving(null);
  }

  const count = participants.length;

  return (
    <section className={styles.card} aria-label="Personen">
      <h2 className={styles.cardTitle}>
        Personen
        <span className={styles.count}>
          {` · ${count} ${count === 1 ? "Person" : "Personen"}`}
        </span>
      </h2>
      <ul className={styles.list}>
        {participants.map((participant) => (
          <li key={participant.id} className={styles.item}>
            {editingId === participant.id ? (
              <ParticipantForm
                participant={participant}
                onSaved={handleSaved}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ParticipantRow
                participant={participant}
                activity={activity[participant.id] ?? null}
                self={participant.id === selfParticipantId}
                onEdit={() => {
                  setAdding(false);
                  setEditingId(participant.id);
                }}
                onRemove={() => setRemoving(participant)}
                onToggleAccountAdmin={(next) =>
                  void toggleAccountAdmin(participant, next)
                }
              />
            )}
          </li>
        ))}
      </ul>
      {notice && (
        <p
          className={styles.notice}
          role="alert"
          data-testid="account-admin-notice"
        >
          {notice}
        </p>
      )}
      {adding ? (
        <div className={styles.item}>
          <ParticipantForm
            participant={null}
            onSaved={handleSaved}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.addButton}
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
        >
          <PlusIcon />
          Teilnehmer hinzufügen
        </button>
      )}
      {removing && (
        <ParticipantDeleteDialog
          participant={removing}
          onDeleted={handleDeleted}
          onCancel={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
