"use client";

import { useState } from "react";
import Link from "next/link";
import { startRegistration } from "@simplewebauthn/browser";
import { CompassIcon } from "@/components/compass-icon";
import { usePasskeySupport } from "@/components/use-passkey-support";
import {
  PASSKEY_CREATED_NOTICE,
  PASSKEY_SETUP_FAILED_NOTICE,
} from "@/lib/auth/messages";
import {
  DEVICES_API,
  LOGOUT_ALL_API,
  LOGOUT_API,
  PASSKEY_REGISTRATION_API,
  RECOVERY_CODES_API,
} from "@/lib/auth/paths";
import type { Participant } from "@/lib/participants/types";
import type { AccountUser, OpenInvitation } from "@/lib/db/account-users";
import { apiKeyStates, type ApiKeyState } from "@/lib/api-keys/types";
import { PersonenCard, activityByParticipant } from "./personen-card";
import { EinladungenCard } from "./einladungen-card";
import { ZugangsschluesselCard } from "./zugangsschluessel-card";
import cards from "@/components/cards.module.css";
import styles from "./mein-bereich.module.css";

export interface PasskeyInfo {
  id: string;
  label: string;
  /** Fertig formatiert vom Server (siehe lib/auth/devices.ts). */
  hinzugefuegtAm: string;
  /** null, solange mit diesem Gerät noch keine Anmeldung gelaufen ist. */
  zuletztVerwendet: string | null;
}

/** Nach "Überall abmelden" ist auch dieses Gerät draußen. */
export const PASSKEY_REMOVED_NOTICE =
  "Das Gerät ist entfernt. Seine Sitzungen sind damit beendet.";

/**
 * "Mein Bereich" (req-043): die eine Stelle für alles, was zu mir und
 * meinem Account gehört. Sie führt zusammen, was bis dahin auf drei
 * Bereiche verteilt war — „Konto" mit den eigenen Geräten (req-016,
 * req-037), „Account" mit Personen und Zugangsschlüsseln (req-019,
 * req-028, req-032) und „Nutzer" mit Personen und Einladungen (req-038).
 *
 * Die Seite liegt bewusst außerhalb von /plan und /go: beide Bereiche
 * brauchen sie, und der Passkey wird meist auf dem Smartphone eingerichtet
 * (req-043, Constraints).
 *
 * Wer kein Bereichs-Admin ist, sieht nur „Meine Geräte" und — als
 * Reiseleiter — „Notfallcodes"; die übrigen Karten erscheinen gar nicht.
 * Dieselbe Prüfung findet noch einmal serverseitig statt (siehe
 * app/api/participants, app/api/nutzer, app/api/zugangsschluessel) — das
 * Ausblenden ist die Anzeige, nicht der Schutz.
 */
export function MeinBereichView({
  email,
  passkeys,
  offeneNotfallcodes,
  notfallcodesVerfuegbar = true,
  accountAdmin = false,
  participants = [],
  selfParticipantId = "",
  users = [],
  invitations = [],
  apiKeys: initialApiKeys = [],
  navigate = (url: string) => window.location.assign(url),
  copyToClipboard = (text: string) => navigator.clipboard.writeText(text),
  print = () => window.print(),
}: {
  email: string | null;
  passkeys: PasskeyInfo[];
  offeneNotfallcodes: number;
  /**
   * Nur ein Reiseleiter bekommt Notfallcodes (req-023) -- ein Teilnehmer
   * braucht keine, weil ihn der Reiseleiter mit einer neuen Einladung
   * wieder hereinholt.
   */
  notfallcodesVerfuegbar?: boolean;
  /**
   * Ob die angemeldete Person Bereichs-Admin ist (req-027) -- oder der
   * Gesamt-Admin im Bereich, in den er gewechselt ist. Nur dann erscheinen
   * die Karten "Personen", "Einladungen" und "Zugangsschlüssel".
   */
  accountAdmin?: boolean;
  /** Die Personen des Accounts -- nie nach einer Reise gefiltert (req-032). */
  participants?: Participant[];
  /** Die angemeldete Person -- sie ist gekennzeichnet und bleibt in der Liste. */
  selfParticipantId?: string;
  /** Dieselben Personen mit Beitritt und letzter Anmeldung (req-038). */
  users?: AccountUser[];
  /** Die offenen Einladungen des Accounts (req-038). */
  invitations?: OpenInvitation[];
  /**
   * Der Zustand der Zugangsschlüssel des Accounts (req-028) -- gesetzt oder
   * nicht, und die letzten vier Zeichen. Der Schlüssel selbst kommt hier
   * nie an.
   */
  apiKeys?: ApiKeyState[];
  navigate?: (url: string) => void;
  copyToClipboard?: (text: string) => Promise<void>;
  print?: () => void;
}) {
  const [knownPasskeys, setKnownPasskeys] = useState(passkeys);
  const [remaining, setRemaining] = useState(offeneNotfallcodes);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Eine angelegte, geänderte, eingeladene oder entfernte Person steht
  // sofort in der Karte "Personen" -- ohne Neuladen (req-019, req-038).
  const [personen, setPersonen] = useState(participants);
  const [apiKeys, setApiKeys] = useState(() => apiKeyStates(initialApiKeys));
  const passkeysAvailable = usePasskeySupport();

  async function addPasskey() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const optionsResponse = await fetch(PASSKEY_REGISTRATION_API);
      if (!optionsResponse.ok) throw new Error("Aufforderung nicht erhalten");
      const optionsJSON = await optionsResponse.json();

      const antwort = await startRegistration({ optionsJSON });

      const saveResponse = await fetch(PASSKEY_REGISTRATION_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ antwort }),
      });
      if (!saveResponse.ok) throw new Error("Passkey abgewiesen");
      const { bezeichnung, hinzugefuegtAm } = (await saveResponse.json()) as {
        bezeichnung: string;
        hinzugefuegtAm: string;
      };
      setKnownPasskeys((current) => [
        ...current,
        {
          id: antwort.id,
          label: bezeichnung,
          hinzugefuegtAm,
          zuletztVerwendet: null,
        },
      ]);
      setNotice(PASSKEY_CREATED_NOTICE);
    } catch {
      setError(PASSKEY_SETUP_FAILED_NOTICE);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Ein entferntes Gerät ist sofort draußen: mit dem Passkey enden die
   * Sitzungen, die mit ihm entstanden sind (req-037).
   */
  async function removePasskey(id: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(DEVICES_API, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const { error: grund } = (await response.json()) as { error?: string };
        setError(grund ?? PASSKEY_SETUP_FAILED_NOTICE);
        return;
      }
      setKnownPasskeys((current) =>
        current.filter((passkey) => passkey.id !== id),
      );
      setNotice(PASSKEY_REMOVED_NOTICE);
    } catch {
      setError(PASSKEY_SETUP_FAILED_NOTICE);
    } finally {
      setBusy(false);
    }
  }

  async function renewRecoveryCodes() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(RECOVERY_CODES_API, { method: "POST" });
      if (!response.ok) throw new Error("Codes abgewiesen");
      const body = (await response.json()) as {
        codes: string[];
        offen: number;
      };
      setCodes(body.codes);
      setRemaining(body.offen);
    } catch {
      setError("Der neue Satz Notfallcodes konnte nicht erzeugt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch(LOGOUT_API, { method: "POST" });
    } catch {
      // Auch ohne Verbindung geht es auf die Startseite; dort greift beim
      // naechsten Versuch wieder die Anmeldung.
    }
    navigate("/");
  }

  async function logoutEverywhere() {
    setBusy(true);
    try {
      await fetch(LOGOUT_ALL_API, { method: "POST" });
    } catch {
      // Wie beim Abmelden: es geht in jedem Fall auf die Startseite.
    }
    navigate("/");
  }

  /**
   * Eine eingeladene Person steht sofort in der Karte "Personen" -- neu
   * angelegt oder die bereits vorhandene mit derselben Adresse (req-038).
   */
  function handleParticipantInvited(participant: Participant) {
    setPersonen((current) =>
      current.some((person) => person.id === participant.id)
        ? current.map((person) =>
            person.id === participant.id ? participant : person,
          )
        : [...current, participant],
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <CompassIcon />
        </span>
        <div>
          <h1 className={styles.wordmark}>Mein Bereich</h1>
          <div className={styles.tagline}>{email}</div>
        </div>
      </div>

      {(error || notice) && (
        <div className={styles.messages}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
        </div>
      )}

      <div className={`${cards.area} ${styles.cards}`}>
        <section className={cards.card} aria-label="Meine Geräte">
          <h2 className={cards.cardTitle}>Meine Geräte</h2>
          <p className={cards.text}>
            Jedes Gerät bekommt seinen eigenen Passkey — iPhone, iPad und PC.
          </p>
          <button
            type="button"
            className={cards.primaryButton}
            onClick={addPasskey}
            disabled={busy || !passkeysAvailable}
          >
            Dieses Gerät hinzufügen
          </button>
          {!passkeysAvailable && (
            <p className={cards.hint}>
              Dieses Gerät unterstützt keine Passkeys.
            </p>
          )}
          {knownPasskeys.length === 0 ? (
            <p className={cards.text}>
              Für dieses Konto ist noch kein Passkey hinterlegt.
            </p>
          ) : (
            <ul className={cards.deviceList}>
              {knownPasskeys.map((passkey) => (
                <li key={passkey.id} className={cards.deviceItem}>
                  <div>
                    <div className={cards.deviceName}>{passkey.label}</div>
                    <div className={cards.deviceMeta}>
                      Hinzugefügt am {passkey.hinzugefuegtAm}
                    </div>
                    <div className={cards.deviceMeta}>
                      {passkey.zuletztVerwendet
                        ? `Zuletzt verwendet am ${passkey.zuletztVerwendet}`
                        : "Zuletzt verwendet: noch nie"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={cards.secondaryButton}
                    onClick={() => removePasskey(passkey.id)}
                    disabled={busy}
                    aria-label={`${passkey.label} entfernen`}
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className={`${cards.text} ${styles.sessionText}`}>
            Das Abmelden beendet die Sitzung sofort — auf diesem Gerät. „Überall
            abmelden“ beendet alle Sitzungen auf allen Geräten — auch die hier.
            Deine Passkeys bleiben bestehen.
          </p>
          <div className={cards.actions}>
            <button
              type="button"
              className={cards.secondaryButton}
              onClick={logout}
              disabled={busy}
            >
              Abmelden
            </button>
            <button
              type="button"
              className={cards.secondaryButton}
              onClick={logoutEverywhere}
              disabled={busy}
            >
              Überall abmelden
            </button>
          </div>
          <Link className={cards.linkButton} href="/">
            Zurück zur Startseite
          </Link>
        </section>

        {notfallcodesVerfuegbar && (
          <section className={cards.card} aria-label="Notfallcodes">
            <h2 className={cards.cardTitle}>Notfallcodes</h2>
            <p className={cards.text}>
              Noch nicht verbraucht: {remaining} von 8.
            </p>
            {codes && (
              <>
                <p className={cards.text}>
                  Dieser Satz ersetzt den bisherigen und wird nur dieses eine
                  Mal angezeigt.
                </p>
                <ul className={cards.codeList}>
                  {codes.map((code) => (
                    <li key={code} className={cards.codeItem}>
                      {code}
                    </li>
                  ))}
                </ul>
                <div className={cards.actions}>
                  <button
                    type="button"
                    className={cards.secondaryButton}
                    onClick={() => void copyToClipboard(codes.join("\n"))}
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    className={cards.secondaryButton}
                    onClick={print}
                  >
                    Drucken
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              className={cards.secondaryButton}
              onClick={renewRecoveryCodes}
              disabled={busy}
            >
              Neuen Satz erzeugen
            </button>
          </section>
        )}

        {/* Alles Weitere gehört dem ganzen Account und bleibt deshalb dem
            Bereichs-Admin vorbehalten (req-043). */}
        {accountAdmin && (
          <>
            <PersonenCard
              participants={personen}
              onParticipantsChange={setPersonen}
              selfParticipantId={selfParticipantId}
              activity={activityByParticipant(users)}
            />
            <EinladungenCard
              invitations={invitations}
              onParticipantInvited={handleParticipantInvited}
            />
            <ZugangsschluesselCard keys={apiKeys} onChange={setApiKeys} />
          </>
        )}
      </div>
    </div>
  );
}
