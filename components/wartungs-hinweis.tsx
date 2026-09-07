import { MAINTENANCE_TEXT, MAINTENANCE_TITLE } from "@/lib/backup/maintenance";
import styles from "./wartungs-hinweis.module.css";

/**
 * Waehrend einer Wiederherstellung ist die App gesperrt (req-053): jede
 * Seite zeigt statt ihres Inhalts diesen Hinweis. Er steht im Wurzel-Layout
 * und damit vor allem anderen -- auch vor jeder Abfrage der Datenbank, die
 * gerade zurueckgeschrieben wird.
 */
export function WartungsHinweis() {
  return (
    <div className={styles.page}>
      <div className={styles.card} role="status" aria-live="polite">
        <h1 className={styles.title}>{MAINTENANCE_TITLE}</h1>
        <p className={styles.text}>{MAINTENANCE_TEXT}</p>
      </div>
    </div>
  );
}
