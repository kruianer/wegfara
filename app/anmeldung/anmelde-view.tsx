"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { CompassIcon } from "@/components/compass-icon";
import { usePasskeySupport } from "@/components/use-passkey-support";
import { useEntsperrungBeimOeffnen } from "@/components/use-entsperrung-beim-oeffnen";
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
import { brauchtGeste } from "@/lib/auth/entsperrung";
import { merkePasskeyAufDiesemGeraet } from "@/lib/auth/geraete-merker";
import styles from "@/components/auth-panel.module.css";

/**
 * Was die Anmeldeseite gerade zeigt (req-066).
 *
 * "pruefen" ist der Zustand beim Oeffnen: die Marke steht da, sonst
 * nichts. Erst der Effekt entscheidet, was folgt -- vorher ist weder
 * bekannt, ob dieses Geraet einen Passkey hat, noch ob der Browser
 * ueberhaupt welche beherrscht.
 */
type Ansicht = "pruefen" | "entsperren" | "dialog";

/**
 * Die Anmeldeseite (req-016, req-037, req-066): wer sie oeffnet, bekommt
 * die Geraete-Entsperrung ohne Knopfdruck. Verlangt der Browser dafuer
 * eine Geste, steht genau eine Flaeche da und sonst nichts. Erst wenn die
 * Entsperrung scheitert, erscheint der Anmeldedialog.
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
  const [entsperrungGescheitert, setEntsperrungGescheitert] = useState(false);
  const passkeysAvailable = usePasskeySupport();
  const entsperrungBeimOeffnen = useEntsperrungBeimOeffnen();

  /**
   * Was die Seite zeigt, wird nicht gesetzt, sondern abgeleitet: aus dem,
   * was das Geraet kann, und daraus, ob die Entsperrung schon gescheitert
   * ist. Ein Grund in der Adresszeile fuehrt sofort zum Dialog -- er
   * gehoert gelesen, nicht von einer Abfrage ueberdeckt, und bei
   * "keine-reise" endete eine frische Sitzung ohnehin gleich wieder.
   */
  const ansicht: Ansicht =
    fehler || entsperrungGescheitert || entsperrungBeimOeffnen === "nein"
      ? "dialog"
      : entsperrungBeimOeffnen === "ja"
        ? "entsperren"
        : "pruefen";

  /**
   * Nimmt die Antwort des Passkeys entgegen und meldet damit an.
   * Gemeinsamer Abschluss der Entsperrung -- ob sie von selbst kam oder
   * nach einem Tap auf die Flaeche.
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
      // Dieses Geraet hat einen Passkey -- beim naechsten Oeffnen startet
      // die Entsperrung wieder von selbst (req-066).
      merkePasskeyAufDiesemGeraet();
      navigate(ziel);
    },
    [navigate, weiter],
  );

  /**
   * Startet die Geraete-Entsperrung (req-066). `automatisch` unterscheidet
   * den Versuch beim Oeffnen von dem nach einem Tap auf die Flaeche: nur
   * beim automatischen darf eine Weigerung des Browsers folgenlos bleiben,
   * weil der Nutzer dann noch gar nichts getan hat.
   */
  const laufenderVersuch = useRef(0);

  const entsperren = useCallback(
    async (automatisch: boolean) => {
      // Ein zweiter Versuch bricht den ersten ab (siehe
      // WebAuthnAbortService); dessen Absage geht die Ansicht dann nichts
      // mehr an.
      const versuch = (laufenderVersuch.current += 1);
      const beginn = Date.now();
      try {
        const optionsResponse = await fetch(PASSKEY_LOGIN_API);
        if (!optionsResponse.ok) throw new Error("Aufforderung nicht erhalten");
        const optionsJSON = await optionsResponse.json();

        const antwort = await startAuthentication({ optionsJSON });
        await anmelden(antwort);
      } catch (grund) {
        if (versuch !== laufenderVersuch.current) return;
        // Verlangt der Browser eine Geste, bleibt die eine Flaeche stehen:
        // ein Tap, dann Face ID. Niemals ein Formular davor.
        if (automatisch && brauchtGeste(grund, Date.now() - beginn)) return;
        // Erkannt hat die Entsperrung niemanden oder sie wurde
        // abgebrochen -- erst jetzt kommt der Anmeldedialog.
        setError(PASSKEY_FAILED_NOTICE);
        setEntsperrungGescheitert(true);
      }
    },
    [anmelden],
  );

  const entsperrungGestartet = useRef(false);

  /**
   * Beim Oeffnen kommt die Entsperrung von selbst -- ohne Knopfdruck
   * (req-066). Der Merker sorgt dafuer, dass genau eine Abfrage laeuft;
   * im Entwicklungsmodus haengt React jeden Effekt einmal ab und wieder
   * an, und die laufende Abfrage soll das ueberstehen.
   */
  useEffect(() => {
    if (ansicht !== "entsperren" || entsperrungGestartet.current) return;
    entsperrungGestartet.current = true;
    void entsperren(true);
  }, [ansicht, entsperren]);

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

        {/* Verlangt der Browser eine Geste, steht genau diese eine Flaeche
            da -- und sonst nichts: kein Feld, kein Formular (req-066). */}
        {ansicht === "entsperren" && (
          <button
            type="button"
            className={styles.unlock}
            onClick={() => void entsperren(false)}
          >
            Entsperren
          </button>
        )}

        {ansicht === "dialog" && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Anmelden</h2>
            <p className={styles.text}>
              Entsperre dein Gerät, sobald die Abfrage erscheint. Deine
              Reisedaten sind nur nach der Anmeldung sichtbar.
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

            {/* Nur in einer frisch deployten, leeren Umgebung (req-037). Mit
                dem ersten Teilnehmer verschwindet dieser Weg dauerhaft. */}
            {ersteinrichtung && (
              <>
                <div className={styles.separator}>oder</div>
                <Link className={styles.secondaryButton} href={SETUP_PATH}>
                  Ersteinrichtung starten
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
