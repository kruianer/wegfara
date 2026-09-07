import styles from "./nichts-anstehend.module.css";

/**
 * Was der Begleiter in der Vorbereitung zeigt (req-055): solange keine Reise
 * laeuft, gibt es keinen Plan -- und laeuft auch keine Bewertungsrunde,
 * steht hier, dass gerade nichts ansteht. Ein leerer Bildschirm sagt
 * dasselbe, sieht aber aus wie ein Fehler.
 */
export function NichtsAnstehend() {
  return (
    <section className={styles.card} aria-label="Nichts steht an">
      <h2 className={styles.title}>Gerade steht nichts an.</h2>
      <p className={styles.text}>
        Sobald eine Reise läuft, steht hier der Plan des Tages. Läuft eine
        Abstimmung, findest du sie hier.
      </p>
    </section>
  );
}
