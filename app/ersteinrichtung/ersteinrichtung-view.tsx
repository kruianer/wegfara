"use client";

import { useState } from "react";
import Link from "next/link";
import { startRegistration } from "@simplewebauthn/browser";
import { CompassIcon } from "@/components/compass-icon";
import { usePasskeySupport } from "@/components/use-passkey-support";
import { PASSKEY_SETUP_FAILED_NOTICE } from "@/lib/auth/messages";
import { LOGIN_PATH, SETUP_API } from "@/lib/auth/paths";
import styles from "@/components/auth-panel.module.css";

/**
 * Die Ersteinrichtung einer frisch deployten, leeren Umgebung (req-037): ein
 * Passkey, und daraus entstehen in einem Zug der erste Account, der Betreiber
 * mit hinterlegter Adresse und seine Anmeldung -- ohne Kommandozeile.
 */
export function ErsteinrichtungView({
  email,
  navigate = (url: string) => window.location.assign(url),
}: {
  /** Die Adresse, unter der der Betreiber hinterlegt wird. */
  email: string;
  navigate?: (url: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passkeysAvailable = usePasskeySupport();

  async function einrichten() {
    setBusy(true);
    setError(null);
    try {
      const optionsResponse = await fetch(SETUP_API);
      if (!optionsResponse.ok) throw new Error("Aufforderung nicht erhalten");
      const optionsJSON = await optionsResponse.json();

      const antwort = await startRegistration({ optionsJSON });

      const saveResponse = await fetch(SETUP_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ antwort }),
      });
      if (!saveResponse.ok) throw new Error("Ersteinrichtung abgewiesen");
      const { weiter } = (await saveResponse.json()) as { weiter: string };
      navigate(weiter);
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
          <h2 className={styles.cardTitle}>Ersteinrichtung</h2>
          <p className={styles.text}>
            Diese Umgebung kennt noch niemanden. Richte jetzt deinen Passkey ein
            — daraus entstehen dein Bereich und dein Zugang.
          </p>
          <p className={styles.text}>
            Hinterlegte E-Mail-Adresse: {email}. An sie geht der Anmeldelink,
            falls du einmal ohne dein Gerät dastehst.
          </p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className={styles.primaryButton}
            onClick={einrichten}
            disabled={busy || !passkeysAvailable}
          >
            Passkey einrichten
          </button>

          {!passkeysAvailable && (
            <p className={styles.hint}>
              Dieses Gerät unterstützt keine Passkeys. Die Ersteinrichtung
              braucht eines, das sie beherrscht.
            </p>
          )}

          <Link className={styles.linkButton} href={LOGIN_PATH}>
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
