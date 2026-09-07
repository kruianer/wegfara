"use client";

import { useRef, useState } from "react";
import type { Planvorschlag } from "@/lib/plan/ki-planung";
import { planeMitKi } from "@/lib/plan/run-ki-planung";
import styles from "@/components/dialog.module.css";

/**
 * Das Fenster hinter "KI planen lassen" (req-056): das Haekchen
 * "Bestehendes neu ordnen" und der Hinweis, dass der Lauf ueber den
 * Zugangsschluessel des Accounts abgerechnet wird (req-028).
 *
 * Waehrend des Laufs steht hier der Fortschritt mit "Abbrechen". Abgebrochen
 * bleibt der Plan unveraendert -- gespeichert wird ohnehin erst beim
 * Uebernehmen des Vorschlags.
 */
export function KiPlanungDialog({
  tripId,
  onVorschlag,
  onClose,
}: {
  tripId: string;
  /** Der fertige Vorschlag -- gespeichert ist davon nichts (req-056). */
  onVorschlag: (vorschlag: Planvorschlag) => void;
  onClose: () => void;
}) {
  const [neuOrdnen, setNeuOrdnen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [hinweis, setHinweis] = useState<"fehler" | "nichts" | null>(null);
  const abbruch = useRef<AbortController | null>(null);

  async function planen() {
    if (laeuft) return;
    setLaeuft(true);
    setHinweis(null);

    const controller = new AbortController();
    abbruch.current = controller;
    const ergebnis = await planeMitKi(tripId, neuOrdnen, controller.signal);
    // Wer abgebrochen hat, will kein Ergebnis mehr sehen -- das Fenster ist
    // dann bereits zu.
    if (controller.signal.aborted) return;

    abbruch.current = null;
    setLaeuft(false);
    if (ergebnis.kind === "vorschlag") {
      onVorschlag(ergebnis.vorschlag);
      return;
    }
    setHinweis(ergebnis.kind === "nichts_zu_verplanen" ? "nichts" : "fehler");
  }

  /** Bricht den laufenden Vorgang ab und schliesst das Fenster (req-056). */
  function abbrechen() {
    abbruch.current?.abort();
    abbruch.current = null;
    onClose();
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="KI planen lassen"
      >
        <h2 className={styles.title}>KI planen lassen</h2>
        <p className={styles.text}>
          Die KI verteilt die POIs mit Status „Gesetzt“ und „Wahrscheinlich“ auf
          die Reisetage. Sie sehen das Ergebnis als Vorschlag und entscheiden
          dann.
        </p>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={neuOrdnen}
            disabled={laeuft}
            onChange={(event) => setNeuOrdnen(event.target.checked)}
          />
          Bestehendes neu ordnen
        </label>

        <p className={styles.losses}>
          Ein Lauf wird über den Zugangsschlüssel des Accounts abgerechnet.
        </p>

        {laeuft && (
          <p className={styles.text} role="status" data-testid="ki-fortschritt">
            Die KI plant … Das dauert einen Moment.
          </p>
        )}
        {hinweis === "nichts" && (
          <p className={styles.text} role="alert" data-testid="ki-nichts">
            Es gibt nichts zu verplanen: kein POI steht auf „Gesetzt“ oder
            „Wahrscheinlich“.
          </p>
        )}
        {hinweis === "fehler" && (
          <p className={styles.error} role="alert" data-testid="ki-fehler">
            Die Planung ist fehlgeschlagen. Der Plan ist unverändert.
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={abbrechen}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={laeuft}
            onClick={() => void planen()}
          >
            {laeuft ? "Plant…" : "Planen lassen"}
          </button>
        </div>
      </div>
    </div>
  );
}
