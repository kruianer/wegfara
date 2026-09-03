"use client";

import { useId, useState } from "react";
import type { Participant } from "@/lib/participants/types";
import {
  PARTICIPANT_NAME_MAX_LENGTH,
  validateParticipantDraft,
  type ParticipantDraft,
  type ParticipantFieldErrors,
} from "@/lib/participants/validate";
import {
  saveNewParticipant,
  saveParticipantChanges,
} from "@/lib/participants/save-participant";
import { ParticipantDeleteDialog } from "./participant-delete-dialog";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import styles from "./einstellungen-view.module.css";

const EMPTY_DRAFT: ParticipantDraft = {
  name: "",
  email: "",
  phone: "",
  iban: "",
};

function draftOf(participant: Participant): ParticipantDraft {
  return {
    name: participant.name,
    email: participant.email ?? "",
    phone: participant.phone ?? "",
    iban: participant.iban ?? "",
  };
}

/** Die Initialen fuer den Avatar der Vorlage -- hoechstens zwei. */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  return letters.length > 0 ? letters : "?";
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

    // Die eigene Person behaelt ihre Adresse -- ueber sie laeuft die
    // Anmeldung (siehe delivery/security.md).
    const found = validateParticipantDraft(draft, {
      emailRequired: participant?.loginEnabled ?? false,
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
    ? `Teilnehmer ändern: ${participant.name}`
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

/** Eine Zeile der Liste in der Anzeige (siehe req-019). */
function ParticipantRow({
  participant,
  self,
  onEdit,
  onRemove,
}: {
  participant: Participant;
  self: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const details: { label: string; value: string | null }[] = [
    { label: "E-Mail-Adresse", value: participant.email },
    { label: "Telefonnummer", value: participant.phone },
    { label: "Bankverbindung", value: participant.iban },
  ];

  return (
    <div className={styles.row}>
      <span className={styles.avatar} aria-hidden="true">
        {initials(participant.name)}
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowName}>
          {participant.name}
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
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Teilnehmer ändern: ${participant.name}`}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
        {/* Die eigene Person laesst sich nicht entfernen (req-019). */}
        {!self && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.danger}`}
            aria-label={`Teilnehmer entfernen: ${participant.name}`}
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
 * Der Bereich "Einstellungen" des Planers (siehe req-019). Er zeigt
 * vorerst nur die Karte "Reiseteilnehmer" -- die Eckdaten der Reise aus der
 * Vorlage gehoeren nicht zu diesem Requirement.
 *
 * Die Personen gehoeren zum Account, nicht zu einer einzelnen Reise.
 */
export function EinstellungenView({
  participants: initialParticipants,
  selfParticipantId,
}: {
  participants: Participant[];
  /** Die angemeldete Person -- sie ist gekennzeichnet und bleibt in der Liste. */
  selfParticipantId: string;
}) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Participant | null>(null);

  function handleSaved(saved: Participant) {
    setParticipants((current) =>
      current.some((person) => person.id === saved.id)
        ? current.map((person) => (person.id === saved.id ? saved : person))
        : [...current, saved],
    );
    setEditingId(null);
    setAdding(false);
  }

  function handleDeleted(deleted: Participant) {
    setParticipants((current) =>
      current.filter((person) => person.id !== deleted.id),
    );
    setRemoving(null);
  }

  const count = participants.length;

  return (
    <section className={styles.area} aria-label="Einstellungen">
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          Reiseteilnehmer
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
                  self={participant.id === selfParticipantId}
                  onEdit={() => {
                    setAdding(false);
                    setEditingId(participant.id);
                  }}
                  onRemove={() => setRemoving(participant)}
                />
              )}
            </li>
          ))}
        </ul>
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
      </div>
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
