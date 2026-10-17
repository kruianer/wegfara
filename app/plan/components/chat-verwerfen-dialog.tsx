"use client";

import { useState } from "react";
import { verwerfeChatVerlauf } from "@/lib/chat/senden";
import styles from "@/components/dialog.module.css";

/**
 * Die Rueckfrage vor dem Verwerfen einer Unterhaltung (req-081). Verworfen
 * wird erst nach Bestaetigung: der Verlauf ist danach leer und nicht
 * zurueckzuholen -- ein Fehltipp soll ihn nicht kosten.
 */
export function ChatVerwerfenDialog({
  tripId,
  onVerworfen,
  onCancel,
}: {
  tripId: string;
  onVerworfen: () => void;
  onCancel: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [gescheitert, setGescheitert] = useState(false);

  async function bestaetigen() {
    if (laeuft) return;
    setLaeuft(true);
    setGescheitert(false);

    const verworfen = await verwerfeChatVerlauf(tripId);
    setLaeuft(false);
    if (!verworfen) {
      setGescheitert(true);
      return;
    }
    onVerworfen();
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-label="Unterhaltung verwerfen"
      >
        <h2 className={styles.title}>Unterhaltung verwerfen</h2>
        <p className={styles.text}>
          Der Verlauf dieser Reise wird gelöscht, und du beginnst neu. Das lässt
          sich nicht rückgängig machen.
        </p>
        {gescheitert && (
          <p
            className={styles.error}
            role="alert"
            data-testid="chat-verwerfen-error"
          >
            Die Unterhaltung konnte nicht verworfen werden.
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => void bestaetigen()}
            disabled={laeuft}
          >
            {laeuft ? "Verwirft…" : "Endgültig verwerfen"}
          </button>
        </div>
      </div>
    </div>
  );
}
