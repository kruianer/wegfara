import styles from "./seiten-umschalter.module.css";

export interface Seite<T extends string> {
  id: T;
  label: string;
}

/**
 * Waehlt, welche von zwei Spalten zu sehen ist, wenn nicht alle nebeneinander
 * Platz haben (req-088) -- in der Planung die Spalte neben dem Zeitstrahl, in
 * den Bereichen POIs und Chat eine der beiden Seiten.
 *
 * Er folgt den Reitern der Reisetage (day-tabs.tsx): Text statt nur Symbol,
 * die gewaehlte Seite hervorgehoben -- und jeder Reiter 44x44 px gross
 * (stack.md, Bildschirmbreiten, Regel 4).
 */
export function SeitenUmschalter<T extends string>({
  label,
  seiten,
  gewaehlt,
  onWaehle,
}: {
  /** Wofuer der Umschalter steht -- fuer Vorleseprogramme. */
  label: string;
  seiten: Seite<T>[];
  gewaehlt: T;
  onWaehle: (seite: T) => void;
}) {
  return (
    <div className={styles.reihe} role="tablist" aria-label={label}>
      {seiten.map((seite) => {
        const aktiv = seite.id === gewaehlt;
        return (
          <button
            key={seite.id}
            type="button"
            role="tab"
            aria-selected={aktiv}
            className={`${styles.reiter} ${aktiv ? styles.gewaehlt : ""}`}
            data-testid={`seite-${seite.id}`}
            onClick={() => onWaehle(seite.id)}
          >
            {seite.label}
          </button>
        );
      })}
    </div>
  );
}
