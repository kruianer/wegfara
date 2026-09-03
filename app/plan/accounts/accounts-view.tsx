"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ACCESS_STATUS_LABEL,
  type AccountOverview,
} from "@/lib/accounts/types";
import {
  ACCOUNT_ERRORS,
  validateAccountDraft,
  type AccountDraft,
  type AccountFieldErrors,
} from "@/lib/accounts/validate";
import { saveNewAccount } from "@/lib/accounts/save-account";
import {
  ACCOUNT_SWITCH_ERRORS,
  requestAccountSwitch,
} from "@/lib/accounts/request-switch";
import { requestAccountInvitation } from "@/lib/accounts/request-account-invitation";
import { INVITATION_ERRORS } from "@/lib/invitations/request-invitation";
import type { Invitation } from "@/lib/invitations/types";
import { PLANNER_PATH } from "@/lib/accounts/paths";
import { participantInitials } from "@/lib/participants/display-name";
import { PlusIcon } from "../components/icons";
import { InvitationPanel } from "../components/invitation-panel";
import styles from "./accounts-view.module.css";

const EMPTY_DRAFT: AccountDraft = {
  name: "",
  personName: "",
  personEmail: "",
};

/**
 * Das Formular fuer einen neuen Account (req-025): sein Name und die
 * Angaben zu genau einer ersten Person. Beides gehoert zusammen -- ohne die
 * erste Person gaebe es niemanden, der den Account uebernimmt.
 */
function AccountForm({
  onSaved,
  onCancel,
}: {
  onSaved: (account: AccountOverview) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  function change(field: keyof AccountDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    if (saving) return;

    const found = validateAccountDraft(draft);
    setErrors(found);
    setFailed(false);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = await saveNewAccount(draft);
    setSaving(false);

    if (!result.ok) {
      setErrors(result.errors);
      setFailed(Object.keys(result.errors).length === 0);
      return;
    }
    onSaved(result.account);
  }

  const fields: {
    field: keyof AccountDraft;
    label: string;
    type: string;
  }[] = [
    { field: "name", label: "Name des Accounts", type: "text" },
    { field: "personName", label: "Erste Person", type: "text" },
    { field: "personEmail", label: "E-Mail-Adresse", type: "email" },
  ];

  return (
    <form
      className={styles.form}
      aria-label="Neuer Account"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.formFields}>
        {fields.map(({ field, label, type }) => (
          <div key={field} className={styles.field}>
            <label className={styles.label} htmlFor={`${fieldId}-${field}`}>
              {label}
            </label>
            <input
              id={`${fieldId}-${field}`}
              className={styles.input}
              type={type}
              autoComplete="off"
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
          data-testid="account-save-error"
        >
          {ACCOUNT_ERRORS.failed} Die Eingaben bleiben stehen.
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
          {saving ? "Legt an…" : "Account anlegen"}
        </button>
      </div>
    </form>
  );
}

/**
 * Die Account-Verwaltung (req-025) -- der Bereich, den ausschliesslich der
 * Gesamt-Admin sieht. Sie listet alle Accounts mit Namen, der Anzahl ihrer
 * Personen und dem Zugangsstatus der ersten Person; je Account gibt es eine
 * Schaltflaeche zum Wechseln.
 *
 * Gewechselt wird ueber die Sitzung: nach dem Wechsel laedt der Planer neu
 * und zeigt den anderen Account. Mehrere Accounts nebeneinander sieht der
 * Gesamt-Admin dabei nie.
 */
export function AccountsView({
  accounts: initialAccounts,
  ownAccountId,
  currentAccountId,
  navigate = (url: string) => window.location.assign(url),
  copyToClipboard,
}: {
  accounts: AccountOverview[];
  /** Der Account des Gesamt-Admins selbst. */
  ownAccountId: string;
  /** Der Account, in dem er gerade arbeitet -- der eigene oder ein fremder. */
  currentAccountId: string;
  /** Nur fuer den Test -- sonst der Wechsel der Seite im Browser. */
  navigate?: (url: string) => void;
  /** Nur fuer den Test -- sonst die Zwischenablage des Browsers (req-023). */
  copyToClipboard?: (text: string) => Promise<void>;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [invitationFor, setInvitationFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleSaved(account: AccountOverview) {
    setAccounts((current) => [...current, account]);
    setAdding(false);
    setNotice(null);
  }

  /** Wechselt in den gewaehlten Account und oeffnet dessen Planer. */
  async function wechseln(account: AccountOverview) {
    setNotice(null);
    setBusy(true);
    const ok = await requestAccountSwitch(account.id);
    if (!ok) {
      setBusy(false);
      setNotice(ACCOUNT_SWITCH_ERRORS.failed);
      return;
    }
    // Was zu sehen ist, entscheidet der Server anhand der Sitzung.
    navigate(PLANNER_PATH);
  }

  /**
   * Erzeugt den Zugangslink fuer die erste Person -- nach demselben
   * Verfahren wie bei den Reiseteilnehmern (req-023).
   */
  async function einladen(account: AccountOverview) {
    setNotice(null);
    setInvitation(null);
    setInvitationFor(null);
    setBusy(true);
    const result = await requestAccountInvitation(account.id);
    setBusy(false);

    if (!result.ok) {
      setNotice(INVITATION_ERRORS.failed);
      return;
    }
    setInvitation(result.invitation);
    setInvitationFor(account.id);
    // Der Zugangslink ist erzeugt, aber noch nicht eingeloest -- Zugang hat
    // die Person erst danach (req-023).
    setAccounts((current) =>
      current.map((entry) =>
        entry.id === account.id && entry.firstPerson
          ? {
              ...entry,
              firstPerson:
                entry.firstPerson.access === "eingeloest"
                  ? entry.firstPerson
                  : { ...entry.firstPerson, access: "eingeladen" },
            }
          : entry,
      ),
    );
  }

  const count = accounts.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Account-Verwaltung</h1>
        <Link className={styles.back} href={PLANNER_PATH}>
          Zurück zum Planer
        </Link>
      </header>

      <section className={styles.card} aria-label="Accounts">
        <h2 className={styles.cardTitle}>
          Accounts
          <span className={styles.count}>
            {` · ${count} ${count === 1 ? "Account" : "Accounts"}`}
          </span>
        </h2>
        <p className={styles.hint}>
          Ein Account entsteht ausschließlich hier. Die erste Person kommt über
          ihren Zugangslink herein und verwaltet ihn danach selbst.
        </p>

        <ul className={styles.list}>
          {accounts.map((account) => {
            const aktuell = account.id === currentAccountId;
            const eigen = account.id === ownAccountId;
            const person = account.firstPerson;
            return (
              <li key={account.id} className={styles.item}>
                <div className={styles.row}>
                  <span className={styles.avatar} aria-hidden="true">
                    {participantInitials(account.name)}
                  </span>
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>
                      {account.name}
                      {eigen && (
                        <span className={styles.currentBadge}>
                          Mein Account
                        </span>
                      )}
                      {aktuell && !eigen && (
                        <span className={styles.currentBadge}>Geöffnet</span>
                      )}
                    </div>
                    <p className={styles.firstPerson}>
                      {`${account.personCount} ${
                        account.personCount === 1 ? "Person" : "Personen"
                      }`}
                      {person ? ` · ${person.name}` : ""}
                    </p>
                  </div>
                  {person && (
                    <span
                      className={
                        person.access === "eingeloest"
                          ? styles.accessBadge
                          : `${styles.accessBadge} ${styles.accessBadgeMissing}`
                      }
                    >
                      {ACCESS_STATUS_LABEL[person.access]}
                    </span>
                  )}
                  <div className={styles.rowActions}>
                    {person && (
                      <button
                        type="button"
                        className={styles.actionButton}
                        aria-label={`Einladen: ${person.name}`}
                        disabled={busy}
                        onClick={() => void einladen(account)}
                      >
                        Einladen
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.actionButton}
                      aria-label={`In den Account wechseln: ${account.name}`}
                      disabled={busy || aktuell}
                      onClick={() => void wechseln(account)}
                    >
                      {aktuell ? "Geöffnet" : "Wechseln"}
                    </button>
                  </div>
                </div>
                {invitationFor === account.id && invitation && person && (
                  <InvitationPanel
                    invitation={invitation}
                    name={person.name}
                    onClose={() => {
                      setInvitation(null);
                      setInvitationFor(null);
                    }}
                    copyToClipboard={copyToClipboard}
                  />
                )}
              </li>
            );
          })}
        </ul>

        {notice && (
          <p
            className={styles.notice}
            role="alert"
            data-testid="account-notice"
          >
            {notice}
          </p>
        )}

        {adding ? (
          <div className={styles.item}>
            <AccountForm
              onSaved={handleSaved}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            Account anlegen
          </button>
        )}
      </section>
    </div>
  );
}
