"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { CompassIcon } from "@/components/compass-icon";
import { usePasskeySupport } from "@/components/use-passkey-support";
import { PASSKEY_SETUP_FAILED_NOTICE } from "@/lib/auth/messages";
import { PASSKEY_REGISTRATION_API } from "@/lib/auth/paths";
import styles from "@/components/auth-panel.module.css";

/** Wohin es geht, sobald der Passkey steht. */
export const AFTER_INVITATION = "/";

/**
 * Der erste Bildschirm nach dem Einloesen einer Einladung (req-023): die
 * eingeladene Person ist bereits angemeldet und wird aufgefordert, einen
 * Passkey einzurichten -- damit meldet sie sich kuenftig an. Der
 * Zugangslink ist verbraucht und war nie ein Dauerzugang.
 */
export function EinladungPasskeyView({
  name,
  hatEmail,
  navigate = (url: string) => window.location.assign(url),
}: {
  /** Wie die eingeladene Person angesprochen wird. */
  name: string;
  /**
   * Ob eine E-Mail-Adresse hinterlegt ist. Ohne sie steht der Weg ueber den
   * Anmeldelink nicht zur Verfuegung (req-023).
   */
  hatEmail: boolean;
  navigate?: (url: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passkeysAvailable = usePasskeySupport();

  async function addPasskey() {
    setBusy(true);
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
      navigate(AFTER_INVITATION);
    } catch {
      setError(PASSKEY_SETUP_FAILED_NOTICE);
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
          <h2 className={styles.cardTitle}>Willkommen, {name}</h2>
          <p className={styles.text}>
            Richte jetzt einen Passkey ein. Damit meldest du dich künftig auf
            diesem Gerät an — der Zugangslink war nur der Weg herein und ist
            verbraucht.
          </p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
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
              {hatEmail
                ? "Dieses Gerät unterstützt keine Passkeys. Du meldest dich stattdessen mit einem Anmeldelink an deine E-Mail-Adresse an."
                : "Dieses Gerät unterstützt keine Passkeys. Ohne hinterlegte E-Mail-Adresse steht auch der Anmeldelink nicht zur Verfügung — bitte wende dich an den Reiseleiter."}
            </p>
          )}

          <button
            type="button"
            className={styles.linkButton}
            onClick={() => navigate(AFTER_INVITATION)}
          >
            Später einrichten
          </button>
        </div>
      </div>
    </div>
  );
}
