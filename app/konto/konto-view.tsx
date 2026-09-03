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
  LOGOUT_API,
  PASSKEY_REGISTRATION_API,
  RECOVERY_CODES_API,
} from "@/lib/auth/paths";
import styles from "@/components/auth-panel.module.css";

export interface PasskeyInfo {
  id: string;
  label: string;
}

/**
 * Die Einstellungen des Kontos (req-016): Passkey einrichten, Notfallcodes
 * nachziehen, abmelden. Bewusst ausserhalb von /plan und /go, weil beide
 * Bereiche sie brauchen -- der Passkey wird gerade auf dem Smartphone
 * eingerichtet.
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
      const { bezeichnung } = (await saveResponse.json()) as {
        bezeichnung: string;
      };
      setKnownPasskeys((current) => [
        ...current,
        { id: antwort.id, label: bezeichnung },
      ]);
      setNotice(PASSKEY_CREATED_NOTICE);
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
          <h2 className={styles.cardTitle}>Passkeys</h2>
          {knownPasskeys.length === 0 ? (
            <p className={styles.text}>
              Für dieses Konto ist noch kein Passkey hinterlegt.
            </p>
          ) : (
            <ul className={styles.codeList}>
              {knownPasskeys.map((passkey) => (
                <li key={passkey.id} className={styles.codeItem}>
                  {passkey.label}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={addPasskey}
            disabled={busy || !passkeysAvailable}
          >
            Passkey einrichten
          </button>
          {!passkeysAvailable && (
            <p className={styles.hint}>
              Dieses Gerät unterstützt keine Passkeys.
            </p>
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
          <Link className={styles.linkButton} href="/">
            Zurück zur Startseite
          </Link>
        </section>
      </div>
    </div>
  );
}
