import styles from "./zeitstrahl-linie.module.css";

/**
 * Eine waagrechte Linie im Zeitstrahl des Begleiters (req-086): die
 * "Jetzt"-Linie (Soll) in der Akzentfarbe oder die GPS-Linie (Ist) im
 * GPS-Blau, je mit pulsierendem Punkt auf der Rail und ihrer Beschriftung.
 */
export function Linie({ art, text }: { art: "jetzt" | "gps"; text: string }) {
  return (
    <div
      className={`${styles.linie} ${art === "gps" ? styles.gps : styles.jetzt}`}
      data-testid={art === "gps" ? "gps-linie" : "jetzt-linie"}
    >
      <span className={styles.punktSpalte} aria-hidden="true">
        <span className={styles.punkt} />
      </span>
      <span className={styles.text}>{text}</span>
      <span className={styles.strich} aria-hidden="true" />
    </div>
  );
}
