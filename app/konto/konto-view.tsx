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
import styles from "@/components/auth-panel.module.css";

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
 * Die Einstellungen des Kontos (req-016, req-037): "Meine Geräte" mit allen
 * Passkeys, Notfallcodes nachziehen, abmelden. Bewusst ausserhalb von /plan
 * und /go, weil beide Bereiche sie brauchen -- der Passkey wird gerade auf
 * dem Smartphone eingerichtet.
 */
export function KontoView({
  email,
  passkeys,
  offeneNotfallcodes,
  notfallcodesVerfuegbar = true,
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

  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <CompassIcon />
          </span>
          <h1 className={styles.wordmark}>Konto</h1>
          <div className={styles.tagline}>{email}</div>
        </div>

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

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Meine Geräte</h2>
          <p className={styles.text}>
            Jedes Gerät bekommt seinen eigenen Passkey — iPhone, iPad und PC.
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={addPasskey}
            disabled={busy || !passkeysAvailable}
          >
            Dieses Gerät hinzufügen
          </button>
          {!passkeysAvailable && (
            <p className={styles.hint}>
              Dieses Gerät unterstützt keine Passkeys.
            </p>
          )}
          {knownPasskeys.length === 0 ? (
            <p className={styles.text}>
              Für dieses Konto ist noch kein Passkey hinterlegt.
            </p>
          ) : (
            <ul className={styles.deviceList}>
              {knownPasskeys.map((passkey) => (
                <li key={passkey.id} className={styles.deviceItem}>
                  <div>
                    <div className={styles.deviceName}>{passkey.label}</div>
                    <div className={styles.deviceMeta}>
                      Hinzugefügt am {passkey.hinzugefuegtAm}
                    </div>
                    <div className={styles.deviceMeta}>
                      {passkey.zuletztVerwendet
                        ? `Zuletzt verwendet am ${passkey.zuletztVerwendet}`
                        : "Zuletzt verwendet: noch nie"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
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
        </section>

        {notfallcodesVerfuegbar && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Notfallcodes</h2>
            <p className={styles.text}>
              Noch nicht verbraucht: {remaining} von 8.
            </p>
            {codes && (
              <>
                <p className={styles.text}>
                  Dieser Satz ersetzt den bisherigen und wird nur dieses eine
                  Mal angezeigt.
                </p>
                <ul className={styles.codeList}>
                  {codes.map((code) => (
                    <li key={code} className={styles.codeItem}>
                      {code}
                    </li>
                  ))}
                </ul>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => void copyToClipboard(codes.join("\n"))}
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={print}
                  >
                    Drucken
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={renewRecoveryCodes}
              disabled={busy}
            >
              Neuen Satz erzeugen
            </button>
          </section>
        )}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Sitzung</h2>
          <p className={styles.text}>
            Das Abmelden beendet die Sitzung sofort — auf diesem Gerät.
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={logout}
            disabled={busy}
          >
            Abmelden
          </button>
          <p className={styles.text}>
            „Überall abmelden“ beendet alle Sitzungen auf allen Geräten — auch
            die hier. Deine Passkeys bleiben bestehen.
          </p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={logoutEverywhere}
            disabled={busy}
          >
            Überall abmelden
          </button>
          <Link className={styles.linkButton} href="/">
            Zurück zur Startseite
          </Link>
        </section>
      </div>
    </div>
  );
}
