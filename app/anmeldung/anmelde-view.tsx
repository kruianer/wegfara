"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
} from "@simplewebauthn/browser";
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
  SETUP_PATH,
} from "@/lib/auth/paths";
import styles from "@/components/auth-panel.module.css";

/**
 * Die Anmeldeseite (req-016, req-037): die Geraete-Entsperrung kommt von
 * selbst, sobald die Seite offen ist -- kein Knopf davor. Darunter der
 * Anmeldelink, der Rueckfallweg fuer Browser ohne Conditional UI, das
 * fremde Geraet per QR-Code und der Notfallcode.
 */
export function AnmeldeView({
  weiter,
  fehler = null,
  ersteinrichtung = false,
  navigate = (url: string) => window.location.assign(url),
}: {
  weiter: string;
  /**
   * Warum die Anmeldeseite aufgerufen wurde: ein verbrauchter Anmeldelink,
   * ein verbrauchter Zugangslink oder eine Sitzung, die endete, weil die
   * Person keiner freigegebenen Reise mehr zugeordnet ist (req-023).
   */
  fehler?: LoginError | null;
  /**
   * Ob die Umgebung noch keinen einzigen Teilnehmer kennt (req-037). Nur dann
   * gibt es den Weg in die Ersteinrichtung -- wer ihn sieht, ist der Erste.
   */
  ersteinrichtung?: boolean;
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

  /**
   * Nimmt die Antwort des Passkeys entgegen und meldet damit an. Gemeinsamer
   * Abschluss aller drei Wege -- Conditional UI, Rueckfallknopf und fremdes
   * Geraet.
   */
  const anmelden = useCallback(
    async (antwort: unknown) => {
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
    },
    [navigate, weiter],
  );

  const conditionalGestartet = useRef(false);

  /**
   * Conditional UI (req-037): Die Anmeldung laeuft schon, waehrend die Seite
   * nur dasteht. Der Browser bietet den passenden Passkey von sich aus an --
   * auf dem iPhone als Face ID, auf dem Laptop als Touch ID bzw. Windows
   * Hello -- und haengt ihn zugleich an das Anmeldefeld, das
   * `autocomplete="username webauthn"` traegt.
   *
   * Scheitert das oder bricht der Nutzer ab, bleibt die Seite still: er
   * tippt dann eben seine Adresse ein. Ein Fehlerhinweis waere hier falsch,
   * weil er nichts falsch gemacht hat.
   *
   * Der Merker sorgt dafuer, dass genau eine Abfrage laeuft -- eine zweite
   * wuerde die erste abbrechen (siehe WebAuthnAbortService). Abgebrochen
   * wird beim Aufraeumen bewusst nichts: im Entwicklungsmodus haengt React
   * jeden Effekt einmal ab und wieder an, und die eine laufende Abfrage soll
   * das ueberstehen.
   */
  useEffect(() => {
    if (conditionalGestartet.current) return;
    conditionalGestartet.current = true;

    void (async () => {
      try {
        if (!(await browserSupportsWebAuthnAutofill())) return;
        const optionsResponse = await fetch(PASSKEY_LOGIN_API);
        if (!optionsResponse.ok) return;
        const optionsJSON = await optionsResponse.json();

        const antwort = await startAuthentication({
          optionsJSON,
          useBrowserAutofill: true,
        });
        await anmelden(antwort);
      } catch {
        // Kein passender Passkey, abgebrochen oder kein Conditional UI --
        // die uebrigen Wege stehen weiterhin offen.
      }
    })();
  }, [anmelden]);

  /**
   * Der Rueckfallweg fuer Browser ohne Conditional UI und -- mit
   * `fremdesGeraet` -- der Weg ueber ein anderes Geraet: der Browser zeigt
   * dann seinen QR-Code, der Nutzer scannt ihn mit dem Handy und entsperrt
   * dort per Face ID.
   */
  async function loginWithPasskey(fremdesGeraet = false) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const optionsResponse = await fetch(PASSKEY_LOGIN_API);
      if (!optionsResponse.ok) throw new Error("Aufforderung nicht erhalten");
      const optionsJSON = await optionsResponse.json();

      const antwort = await startAuthentication({
        // "hints" stammt aus WebAuthn Level 3 und steuert den Browser direkt
        // auf den Cross-Device-Flow. Die Typen von @simplewebauthn kennen das
        // Feld noch nicht; durchgereicht wird es trotzdem.
        optionsJSON: fremdesGeraet
          ? { ...optionsJSON, hints: ["hybrid"] }
          : optionsJSON,
      });

      await anmelden(antwort);
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
      // Wortgleich fuer bekannte und unbekannte Adressen (req-016) und auch
      // dann, wenn die Bremse gegriffen hat (req-037).
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
            Entsperre dein Gerät, sobald die Abfrage erscheint. Deine Reisedaten
            sind nur nach der Anmeldung sichtbar.
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

          <form className={styles.form} onSubmit={requestLoginLink}>
            <label className={styles.label} htmlFor="anmeldung-email">
              E-Mail-Adresse
            </label>
            {/* "username webauthn" ist die Voraussetzung dafuer, dass der
                Browser den Passkey von sich aus anbietet (req-037). */}
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

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => loginWithPasskey()}
              disabled={busy || !passkeysAvailable}
            >
              Mit Passkey anmelden
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => loginWithPasskey(true)}
              disabled={busy || !passkeysAvailable}
            >
              Anderes Gerät verwenden
            </button>
          </div>
          {!passkeysAvailable && (
            <p className={styles.hint}>
              Dieses Gerät unterstützt keine Passkeys. Nutze den Anmeldelink
              oder einen Notfallcode.
            </p>
          )}

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

          {/* Nur in einer frisch deployten, leeren Umgebung (req-037). Mit dem
              ersten Teilnehmer verschwindet dieser Weg dauerhaft. */}
          {ersteinrichtung && (
            <>
              <div className={styles.separator}>oder</div>
              <Link className={styles.secondaryButton} href={SETUP_PATH}>
                Ersteinrichtung starten
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
