"use client";

import { useEffect, useState } from "react";
import { CompassIcon } from "@/components/compass-icon";
import { RECOVERY_CODES_API } from "@/lib/auth/paths";
import styles from "@/components/auth-panel.module.css";

export const RECOVERY_CODES_GONE_NOTICE =
  "Die Notfallcodes wurden bereits angezeigt. Einen neuen Satz erzeugst du in den Einstellungen deines Kontos.";

/**
 * Zeigt die Notfallcodes genau einmal an (req-016): sie lassen sich
 * kopieren und drucken, und erst nach der Bestaetigung geht es weiter.
 * Die Codes kommen aus einer Schnittstelle, die sie beim Ausliefern
 * verwirft -- ein erneuter Aufruf dieser Seite zeigt nichts mehr.
 */
export function NotfallcodesView({
  weiter,
  navigate = (url: string) => window.location.assign(url),
  copyToClipboard = (text: string) => navigator.clipboard.writeText(text),
  print = () => window.print(),
}: {
  weiter: string;
  navigate?: (url: string) => void;
  copyToClipboard?: (text: string) => Promise<void>;
  print?: () => void;
}) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(RECOVERY_CODES_API);
        const body = (await response.json()) as { codes?: string[] | null };
        if (active) setCodes(body.codes ?? null);
      } catch {
        if (active) setCodes(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function copyCodes() {
    if (!codes) return;
    try {
      await copyToClipboard(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
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
          <h2 className={styles.cardTitle}>Deine Notfallcodes</h2>

          {loading && <p className={styles.text}>Einen Moment …</p>}

          {!loading && !codes && (
            <>
              <p className={styles.notice} role="status">
                {RECOVERY_CODES_GONE_NOTICE}
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => navigate(weiter)}
              >
                Weiter
              </button>
            </>
          )}

          {!loading && codes && (
            <>
              <p className={styles.text}>
                Verwahre diese Codes sicher. Jeder Code ersetzt einmal die
                Anmeldung und ist danach verbraucht. Sie werden nur dieses eine
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
                  onClick={copyCodes}
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
              {copied && (
                <p className={styles.hint} role="status">
                  Die Codes liegen in der Zwischenablage.
                </p>
              )}
              <label className={styles.confirmRow}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                Ich habe die Notfallcodes sicher verwahrt.
              </label>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!confirmed}
                onClick={() => navigate(weiter)}
              >
                Weiter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
