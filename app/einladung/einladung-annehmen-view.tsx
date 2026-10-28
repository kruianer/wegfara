"use client";

import { useEffect, useRef } from "react";
import { CompassIcon } from "@/components/compass-icon";
import { INVITATION_REDEEM_API } from "@/lib/auth/paths";
import styles from "@/components/auth-panel.module.css";

/**
 * Nimmt eine Einladung an (bug-068). Beim Oeffnen schickt die Seite das
 * Token sofort von selbst ab -- die eingeladene Person tippt nichts an und
 * landet gleich in der Passkey-Einrichtung (req-066).
 *
 * Ein Formular statt eines fetch, weil der Browser dabei selbst der
 * Weiterleitung folgt und das Sitzungs-Cookie mitnimmt. Eine Link-Vorschau
 * fuehrt dieses Skript nicht aus; sie verbraucht die Einladung deshalb
 * nicht mehr. Springt das Absenden nicht an, bleibt der Knopf.
 */
export function EinladungAnnehmenView({
  token,
  absenden = (form: HTMLFormElement) => form.submit(),
}: {
  token: string;
  absenden?: (form: HTMLFormElement) => void;
}) {
  const formular = useRef<HTMLFormElement>(null);
  const abgeschickt = useRef(false);

  useEffect(() => {
    // Genau ein Absenden: im Entwicklungsmodus laeuft jeder Effekt zweimal.
    if (abgeschickt.current || !formular.current) return;
    abgeschickt.current = true;
    absenden(formular.current);
  }, [absenden]);

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

        <form ref={formular} method="post" action={INVITATION_REDEEM_API}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={styles.unlock}>
            Einladung annehmen
          </button>
        </form>
      </div>
    </div>
  );
}
