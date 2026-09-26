import styles from "./nichts-anstehend.module.css";

/**
 * Was der Begleiter zeigt, wenn es nichts zu zeigen gibt (req-055): keine
 * sichtbare Reise, also auch kein Plan und keine Bewertungsrunde. Ein leerer
 * Bildschirm sagt dasselbe, sieht aber aus wie ein Fehler.
 *
 * Seit bug-054 ist das der einzige Fall: Den Plan einer Reise zeigt der
 * Begleiter auch vor ihrem Beginn, und ein Reisetag ohne Programmpunkte sagt
 * im Zeitstrahl selbst, dass dort noch nichts geplant ist.
 */
export function NichtsAnstehend() {
  return (
    <section className={styles.card} aria-label="Nichts steht an">
      <h2 className={styles.title}>Gerade steht nichts an.</h2>
      <p className={styles.text}>
        Sobald du zu einer Reise gehörst, steht hier ihr Plan. Läuft eine
        Abstimmung, findest du sie hier.
      </p>
    </section>
  );
}
