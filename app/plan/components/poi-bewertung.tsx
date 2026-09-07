import type { Bewertungsstand } from "@/lib/bewertungen/stand";
import { STIMM_WAHL_LABEL } from "@/lib/bewertungen/types";
import styles from "./poi-bewertung.module.css";

/**
 * Der Stand der Bewertung an einer POI-Zeile des Planers (req-054): die
 * Verteilung der Stimmen, wer wie gestimmt hat, wer noch fehlt und wer nicht
 * dabei ist.
 *
 * Nur zum Lesen -- abgestimmt wird im Begleiter. Der Status des POI daneben
 * bleibt davon unberuehrt: er beschreibt den Ort, die Stimme die Person, und
 * aus den Stimmen folgt nie ein Status.
 */
export function PoiBewertung({
  poiId,
  stand,
}: {
  poiId: string;
  stand: Bewertungsstand;
}) {
  const abgegebene = stand.verteilung.filter((eintrag) => eintrag.anzahl > 0);
  const laeuft = stand.runde.status === "laeuft";

  return (
    <div className={styles.block} data-testid={`poi-bewertung-${poiId}`}>
      <div className={styles.head}>
        <span className={styles.badge}>
          {laeuft ? "In Bewertung" : "Bewertet"}
        </span>
        {abgegebene.length === 0 ? (
          <span className={styles.leer}>Noch keine Stimme</span>
        ) : (
          <ul className={styles.verteilung}>
            {abgegebene.map((eintrag) => (
              <li key={eintrag.wahl} className={styles.wahl}>
                {STIMM_WAHL_LABEL[eintrag.wahl]}: {eintrag.anzahl}
              </li>
            ))}
          </ul>
        )}
      </div>
      {stand.abgegeben.length > 0 && (
        <p className={styles.zeile}>
          Stimmen:{" "}
          {stand.abgegeben
            .map(
              (stimme) => `${stimme.name} — ${STIMM_WAHL_LABEL[stimme.wahl]}`,
            )
            .join(" · ")}
        </p>
      )}
      {stand.fehlend.length > 0 && (
        <p className={styles.zeile}>
          Fehlt noch: {stand.fehlend.map((person) => person.name).join(", ")}
        </p>
      )}
      {stand.ohneMich.length > 0 && (
        <p className={`${styles.zeile} ${styles.ohneMich}`}>
          Nicht dabei: {stand.ohneMich.map((person) => person.name).join(", ")}
        </p>
      )}
    </div>
  );
}
