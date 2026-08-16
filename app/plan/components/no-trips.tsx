"use client";

import styles from "./no-trips.module.css";

/**
 * Steht an Stelle der Ansicht, solange es keine Reise gibt (siehe req-017) —
 * mit der Aufforderung, eine anzulegen.
 */
export function NoTrips({ onCreateTrip }: { onCreateTrip: () => void }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Noch keine Reise</h1>
        <p className={styles.text}>
          Lege deine erste Reise an — mit Titel, Zeitraum und Hauptort. Danach
          sammelst du POIs und planst die Tage.
        </p>
        <button type="button" className={styles.button} onClick={onCreateTrip}>
          Neue Reise
        </button>
      </div>
    </div>
  );
}
