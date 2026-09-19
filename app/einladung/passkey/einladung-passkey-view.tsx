"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { CompassIcon } from "@/components/compass-icon";
import { usePasskeySupport } from "@/components/use-passkey-support";
import { PASSKEY_REGISTRATION_API } from "@/lib/auth/paths";
import { brauchtGeste } from "@/lib/auth/entsperrung";
import { passkeyFehlerText, serverFehler } from "@/lib/auth/passkey-fehler";
import { merkePasskeyAufDiesemGeraet } from "@/lib/auth/geraete-merker";
import styles from "@/components/auth-panel.module.css";

/** Wohin es geht, sobald der Passkey steht. */
export const AFTER_INVITATION = "/";

/**
 * Der erste Bildschirm nach dem Einloesen einer Einladung (req-023,
 * req-066): die eingeladene Person ist bereits angemeldet, und das
 * Einrichten des Passkeys laeuft sofort los -- auf jedem Geraet, mit dem
 * sie den Link oeffnet: iPhone und iPad per Face ID, Windows-Laptop per
 * Windows Hello, Android per Fingerabdruck. Kein Zwischenschritt ueber
 * einen Anmeldelink.
 *
 * Verlangt der Browser dafuer eine Geste, bleibt genau eine Flaeche
 * stehen. Erst wenn das Einrichten scheitert, erscheint der Grund samt der
 * Wege daneben.
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
  const [gescheitert, setGescheitert] = useState(false);
  const passkeysAvailable = usePasskeySupport();

  /**
   * Abgeleitet statt gesetzt: solange nichts schiefging und der Browser
   * Passkeys beherrscht, steht die eine Flaeche da -- und dahinter laeuft
   * die Einrichtung bereits.
   */
  const ansicht: "einrichten" | "gescheitert" =
    gescheitert || !passkeysAvailable ? "gescheitert" : "einrichten";

  const laufenderVersuch = useRef(0);

  /**
   * Richtet den Passkey ein. `automatisch` unterscheidet den Versuch beim
   * Oeffnen von dem nach einem Tap: nur beim automatischen darf eine
   * Weigerung des Browsers folgenlos bleiben, weil die Person dann noch
   * gar nichts getan hat.
   */
  const einrichten = useCallback(
    async (automatisch: boolean) => {
      const versuch = (laufenderVersuch.current += 1);
      const beginn = Date.now();
      try {
        const optionsResponse = await fetch(PASSKEY_REGISTRATION_API);
        if (!optionsResponse.ok)
          throw await serverFehler(optionsResponse, "einrichten");
        const optionsJSON = await optionsResponse.json();

        const antwort = await startRegistration({ optionsJSON });

        const saveResponse = await fetch(PASSKEY_REGISTRATION_API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ antwort }),
        });
        if (!saveResponse.ok)
          throw await serverFehler(saveResponse, "einrichten");
        // Ab jetzt startet die Anmeldeseite die Entsperrung von selbst
        // (req-066).
        merkePasskeyAufDiesemGeraet();
        navigate(AFTER_INVITATION);
      } catch (grund) {
        if (versuch !== laufenderVersuch.current) return;
        // Ein Tap, dann Face ID -- niemals ein Knopf mehr als noetig.
        if (automatisch && brauchtGeste(grund, Date.now() - beginn)) return;
        // Der Grund steht da, nicht ein Satz, der fuer jeden Grund
        // derselbe ist (req-066).
        setError(passkeyFehlerText(grund, "einrichten"));
        setGescheitert(true);
      }
    },
    [navigate],
  );

  const gestartet = useRef(false);

  useEffect(() => {
    if (ansicht !== "einrichten" || gestartet.current) return;
    gestartet.current = true;
    void einrichten(true);
  }, [ansicht, einrichten]);

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

        {ansicht === "einrichten" ? (
          <button
            type="button"
            className={styles.unlock}
            onClick={() => void einrichten(false)}
          >
            Willkommen, {name} — Passkey einrichten
          </button>
        ) : (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Willkommen, {name}</h2>
            <p className={styles.text}>
              Mit einem Passkey meldest du dich künftig auf diesem Gerät an —
              der Zugangslink war nur der Weg herein und ist verbraucht.
            </p>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void einrichten(false)}
              disabled={!passkeysAvailable}
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
        )}
      </div>
    </div>
  );
}
