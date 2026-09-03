"use client";

import { useState } from "react";
import { requestReturnToOwnAccount } from "@/lib/accounts/request-switch";
import { PLANNER_PATH } from "@/lib/accounts/paths";
import styles from "./fremder-account-balken.module.css";

/**
 * Weist darauf hin, in wessen Account der Gesamt-Admin gerade arbeitet
 * (req-025) -- samt der Schaltflaeche zurueck in den eigenen.
 *
 * Der Balken liegt ueber dem Kopfbereich und wird auf jeder Seite gezeigt:
 * gerendert wird er im Root-Layout, nicht im Planer. Erscheint er nicht,
 * arbeitet der Gesamt-Admin im eigenen Account.
 */
export function FremderAccountBalken({
  accountName,
  navigate = (url: string) => window.location.assign(url),
}: {
  accountName: string;
  /** Nur fuer den Test -- sonst der Wechsel der Seite im Browser. */
  navigate?: (url: string) => void;
}) {
  const [zurueckkehrend, setZurueckkehrend] = useState(false);

  async function zurueck() {
    setZurueckkehrend(true);
    const ok = await requestReturnToOwnAccount();
    if (!ok) {
      setZurueckkehrend(false);
      return;
    }
    // Was zu sehen ist, entscheidet der Server anhand der Sitzung -- die
    // Seite wird deshalb neu geladen statt im Browser nachgezogen.
    navigate(PLANNER_PATH);
  }

  return (
    <div className={styles.balken} role="status" data-testid="fremder-account">
      <span className={styles.text}>
        Du arbeitest im Account{" "}
        <span className={styles.accountName}>{accountName}</span> — nicht in
        deinem eigenen.
      </span>
      <button
        type="button"
        className={styles.zurueck}
        disabled={zurueckkehrend}
        onClick={() => void zurueck()}
      >
        {zurueckkehrend ? "Kehrt zurück…" : "Zurück in meinen Account"}
      </button>
    </div>
  );
}
