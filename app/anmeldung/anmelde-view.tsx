"use client";

import { useState, type FormEvent } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { CompassIcon } from "@/components/compass-icon";
import { usePasskeySupport } from "@/components/use-passkey-support";
import {
  LOGIN_ERROR_NOTICE,
  LOGIN_FAILED_NOTICE,
  PASSKEY_FAILED_NOTICE,
  type LoginError,
} from "@/lib/auth/messages";
import {
  LOGIN_LINK_API,
  PASSKEY_LOGIN_API,
  RECOVERY_CODE_LOGIN_API,
} from "@/lib/auth/paths";
import styles from "@/components/auth-panel.module.css";

/**
 * Die Anmeldeseite (req-016): zuerst der Passkey, darunter die
 * Alternativen Anmeldelink und Notfallcode -- ohne die Seite zu
 * wechseln.
 */
export function AnmeldeView({
  weiter,
  fehler = null,
  navigate = (url: string) => window.location.assign(url),
}: {
  weiter: string;
  /**
   * Warum die Anmeldeseite aufgerufen wurde: ein verbrauchter Anmeldelink,
   * ein verbrauchter Zugangslink oder eine Sitzung, die endete, weil die
   * Person keiner freigegebenen Reise mehr zugeordnet ist (req-023).
   */
  fehler?: LoginError | null;
  navigate?: (url: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeFormOpen, setCodeFormOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    fehler ? LOGIN_ERROR_NOTICE[fehler] : null,
  );
  const [busy, setBusy] = useState(false);
  const passkeysAvailable = usePasskeySupport();

  async function loginWithPasskey() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const optionsResponse = await fetch(PASSKEY_LOGIN_API);
      if (!optionsResponse.ok) throw new Error("Aufforderung nicht erhalten");
      const optionsJSON = await optionsResponse.json();

      const antwort = await startAuthentication({ optionsJSON });

      const loginResponse = await fetch(PASSKEY_LOGIN_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ antwort, weiter }),
      });
      if (!loginResponse.ok) throw new Error("Anmeldung abgewiesen");
      const { weiter: ziel } = (await loginResponse.json()) as {
        weiter: string;
      };
      navigate(ziel);
    } catch {
      setError(PASSKEY_FAILED_NOTICE);
    } finally {
      setBusy(false);
    }
  }

  async function requestLoginLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(LOGIN_LINK_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, weiter }),
      });
      const { notice: rueckmeldung } = (await response.json()) as {
        notice: string;
      };
      // Wortgleich fuer bekannte und unbekannte Adressen (req-016).
      setNotice(rueckmeldung);
    } catch {
      setError(LOGIN_FAILED_NOTICE);
    } finally {
      setBusy(false);
    }
  }

  async function loginWithRecoveryCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(RECOVERY_CODE_LOGIN_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code, weiter }),
      });
      if (!response.ok) {
        setError(LOGIN_FAILED_NOTICE);
        return;
      }
      const { weiter: ziel } = (await response.json()) as { weiter: string };
      navigate(ziel);
    } catch {
      setError(LOGIN_FAILED_NOTICE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <CompassIcon />
          </span>
          <h1 className={styles.wordmark}>Wegfara</h1>
          <div className={styles.tagline}>KI · Reiseplanung</div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Anmelden</h2>
          <p className={styles.text}>
            Deine Reisedaten sind nur nach der Anmeldung sichtbar.
          </p>

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

          <button
            type="button"
            className={styles.primaryButton}
            onClick={loginWithPasskey}
            disabled={busy || !passkeysAvailable}
          >
            Mit Passkey anmelden
          </button>
          {!passkeysAvailable && (
            <p className={styles.hint}>
              Dieses Gerät unterstützt keine Passkeys. Nutze den Anmeldelink
              oder einen Notfallcode.
            </p>
          )}

          <div className={styles.separator}>oder</div>

          <form className={styles.form} onSubmit={requestLoginLink}>
            <label className={styles.label} htmlFor="anmeldung-email">
              E-Mail-Adresse
            </label>
            <input
              id="anmeldung-email"
              className={styles.input}
              type="email"
              autoComplete="username webauthn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              type="submit"
              className={styles.secondaryButton}
              disabled={busy}
            >
              Anmeldelink senden
            </button>
          </form>

          {codeFormOpen ? (
            <form className={styles.form} onSubmit={loginWithRecoveryCode}>
              <label className={styles.label} htmlFor="anmeldung-notfallcode">
                Notfallcode
              </label>
              <input
                id="anmeldung-notfallcode"
                className={`${styles.input} ${styles.codeInput}`}
                type="text"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <button
                type="submit"
                className={styles.secondaryButton}
                disabled={busy}
              >
                Mit Notfallcode anmelden
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setCodeFormOpen(true)}
            >
              Notfallcode verwenden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
