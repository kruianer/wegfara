"use client";

import { useEffect, useId, useState } from "react";
import type { AccountUser, OpenInvitation } from "@/lib/db/account-users";
import type { Invitation } from "@/lib/invitations/types";
import {
  USER_ERRORS,
  inviteUserRequest,
  loadAccountUsers,
  withdrawInvitationRequest,
} from "@/lib/users/request-users";
import { formatDay, formatMoment } from "@/lib/users/format";
import {
  ACCOUNT_ADMIN_ERRORS,
  canSetAccountAdmin,
} from "@/lib/participants/account-admin";
import { saveAccountAdmin } from "@/lib/participants/save-account-admin";
import { deleteParticipantRequest } from "@/lib/participants/save-participant";
import type { ParticipantFieldErrors } from "@/lib/participants/validate";
import { InvitationPanel } from "./invitation-panel";
import { PlusIcon, TrashIcon } from "./icons";
import styles from "./plan-cards.module.css";
import dialogStyles from "./dialog.module.css";

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
  onInvited: (invitation: Invitation, name: string) => void;
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
    onInvited(result.invitation, name.trim());
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
 * Der Bereich "Nutzer" des Planers (req-038). Er fuehrt zusammen, was
 * bisher ueber die Teilnehmerverwaltung (req-019, req-027) und die
 * Zugangslinks (req-023) verstreut war: wer im Account ist, wer noch
 * eingeladen ist und wann seine Einladung ablaeuft.
 *
 * Sichtbar nur fuer einen Bereichs-Admin -- und fuer den Gesamt-Admin im
 * Bereich, in den er gewechselt ist. Dieselbe Pruefung findet noch einmal
 * serverseitig statt (siehe app/api/nutzer/route.ts): das Ausblenden ist
 * Bequemlichkeit, kein Schutz.
 */
export function NutzerView({
  selfParticipantId,
  onParticipantRemoved = () => {},
}: {
  /** Die angemeldete Person -- sie ist gekennzeichnet und bleibt in der Liste. */
  selfParticipantId: string;
  /**
   * Mit einer entfernten Person enden ihre Zuordnungen; die uebrigen
   * Bereiche des Planers ziehen darueber nach, ohne neu zu laden.
   */
  onParticipantRemoved?: (participantId: string) => void;
}) {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [invitations, setInvitations] = useState<OpenInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  // Die Rueckfrage vor dem Entfernen -- mit der Person enden ihre
  // Sitzungen, und das laesst sich nicht zurueckholen.
  const [removing, setRemoving] = useState<AccountUser | null>(null);
  // Der Zugangslink wird genau einmal gezeigt -- unmittelbar nach dem
  // Erstellen. Danach nie wieder, weil nur sein Hash gespeichert ist.
  const [invitation, setInvitation] = useState<{
    invitation: Invitation;
    name: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAccountUsers().then((geladen) => {
      if (cancelled) return;
      if (!geladen) {
        setNotice(USER_ERRORS.loadFailed);
      } else {
        setUsers(geladen.users);
        setInvitations(geladen.invitations);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleInvited(neu: Invitation, name: string) {
    setInviting(false);
    setNotice(null);
    setInvitation({ invitation: neu, name });
    void loadAccountUsers().then((geladen) => {
      if (!geladen) return;
      setUsers(geladen.users);
      setInvitations(geladen.invitations);
    });
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

  /**
   * Ernennt eine Person zum Bereichs-Admin oder entzieht ihr die
   * Kennzeichnung (req-027). Der letzte behaelt sie -- geprueft wird hier
   * und in der Schnittstelle mit derselben Regel.
   */
  async function toggleAccountAdmin(user: AccountUser, next: boolean) {
    setNotice(null);
    const asParticipants = users.map((person) => ({
      id: person.id,
      accountAdmin: person.accountAdmin,
    }));
    if (!canSetAccountAdmin(asParticipants, user.id, next)) {
      setNotice(ACCOUNT_ADMIN_ERRORS.lastAdmin);
      return;
    }

    const result = await saveAccountAdmin(user.id, next);
    if (!result.ok) {
      setNotice(
        result.reason === "lastAdmin"
          ? ACCOUNT_ADMIN_ERRORS.lastAdmin
          : ACCOUNT_ADMIN_ERRORS.failed,
      );
      return;
    }
    setUsers((current) =>
      current.map((person) =>
        person.id === user.id ? { ...person, accountAdmin: next } : person,
      ),
    );
  }

  /**
   * Entfernt eine Person aus dem Bereich (req-038). Mit ihr enden ihre
   * Sitzungen sofort. Der letzte Bereichs-Admin bleibt -- die Abweisung
   * kommt vom Server und wird hier nur wiedergegeben.
   */
  async function remove(user: AccountUser) {
    setNotice(null);
    const result = await deleteParticipantRequest(user.id);
    setRemoving(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setUsers((current) => current.filter((person) => person.id !== user.id));
    setInvitations((current) =>
      current.filter((offen) => offen.participantId !== user.id),
    );
    onParticipantRemoved(user.id);
  }

  return (
    <section className={styles.area} aria-label="Nutzer">
      <section className={styles.card} aria-label="Personen">
        <h2 className={styles.cardTitle}>
          Personen
          <span className={styles.count}>
            {` · ${users.length} ${users.length === 1 ? "Person" : "Personen"}`}
          </span>
        </h2>
        {loading ? (
          <p className={styles.emptyHint}>Lädt…</p>
        ) : (
          <ul className={styles.list}>
            {users.map((user) => (
              <li key={user.id} className={styles.item}>
                <div className={styles.row}>
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>
                      {user.name}
                      {user.id === selfParticipantId && (
                        <span className={styles.selfBadge}>Du</span>
                      )}
                    </div>
                    <dl className={styles.details}>
                      <div className={styles.detail}>
                        <dt className={styles.detailLabel}>E-Mail-Adresse</dt>
                        <dd className={styles.detailValue}>
                          {user.email ?? "—"}
                        </dd>
                      </div>
                      <div className={styles.detail}>
                        <dt className={styles.detailLabel}>Beitritt</dt>
                        <dd className={styles.detailValue}>
                          {formatDay(user.joinedAt)}
                        </dd>
                      </div>
                      <div className={styles.detail}>
                        <dt className={styles.detailLabel}>Letzte Anmeldung</dt>
                        <dd className={styles.detailValue}>
                          {formatDay(user.lastSignInAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <label
                    className={
                      user.accountAdmin
                        ? `${styles.adminToggle} ${styles.adminToggleOn}`
                        : styles.adminToggle
                    }
                  >
                    <input
                      type="checkbox"
                      className={styles.adminCheckbox}
                      aria-label={`Bereichs-Admin: ${user.name}`}
                      checked={user.accountAdmin}
                      onChange={(event) =>
                        void toggleAccountAdmin(user, event.target.checked)
                      }
                    />
                    Bereichs-Admin
                  </label>
                  <div className={styles.rowActions}>
                    {/* Die eigene Person laesst sich nicht entfernen
                        (req-019) -- sonst entfiele mit ihr die Sitzung, mit
                        der gerade gearbeitet wird. */}
                    {user.id !== selfParticipantId && (
                      <button
                        type="button"
                        className={`${styles.iconButton} ${styles.danger}`}
                        aria-label={`Person entfernen: ${user.name}`}
                        onClick={() => setRemoving(user)}
                      >
                        <TrashIcon />
                      </button>
                    )}
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

      <section className={styles.card} aria-label="Offene Einladungen">
        <h2 className={styles.cardTitle}>
          Offene Einladungen
          <span className={styles.count}>{` · ${invitations.length}`}</span>
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
      </section>

      {removing && (
        <div className={dialogStyles.overlay}>
          <div
            className={dialogStyles.card}
            role="alertdialog"
            aria-modal="true"
            aria-label="Person entfernen"
          >
            <h2 className={dialogStyles.title}>Person entfernen</h2>
            <p className={dialogStyles.text}>
              „{removing.name}“ wird aus dem Bereich entfernt und ist sofort
              abgemeldet. Das lässt sich nicht rückgängig machen.
            </p>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.secondaryButton}
                onClick={() => setRemoving(null)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className={dialogStyles.dangerButton}
                onClick={() => void remove(removing)}
              >
                Endgültig entfernen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
