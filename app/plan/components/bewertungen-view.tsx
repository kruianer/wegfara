"use client";

import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde } from "@/lib/bewertungen/types";
import { POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import { anzuzeigendeRunde, rundenzeilen } from "@/lib/bewertungen/rundenstand";
import styles from "./bewertungen-view.module.css";

/** Was dort steht, wo es noch nie eine Runde gab (req-063). */
export const KEINE_RUNDE_HINWEIS =
  "Noch keine Bewertungsrunde. Im Bereich POIs lässt sich eine starten.";

/**
 * Der Bereich "Bewertungen" des Planers (req-063): der Stand der laufenden
 * Bewertungsrunde an einer Stelle, statt verstreut über die POI-Liste. Läuft
 * keine, steht hier die zuletzt beendete -- ihre Stimmen bleiben sichtbar
 * (req-054).
 *
 * Gezeigt und entschieden wird hier; abgestimmt wird ausschließlich im
 * Begleiter. Aus den Stimmen folgt nie ein Status -- den setzt weiterhin der
 * Reiseleiter (req-054).
 */
export function BewertungenView({
  pois = [],
  runden = [],
}: {
  /** Die POIs der geoeffneten Reise -- an ihnen stehen Name und Status. */
  pois?: Poi[];
  /** Die Bewertungsrunden der geoeffneten Reise (req-054). */
  runden?: Bewertungsrunde[];
}) {
  const runde = anzuzeigendeRunde(runden);
  const zeilen = runde ? rundenzeilen(runde, pois) : [];

  return (
    <section className={styles.area} aria-label="Bewertungen">
      <div className={styles.head}>
        <h2 className={styles.title}>Bewertungen</h2>
      </div>
      {!runde ? (
        <p className={styles.empty}>{KEINE_RUNDE_HINWEIS}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Stand der Runde">
            <thead>
              <tr>
                <th scope="col">POI</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody data-testid="bewertungszeilen">
              {zeilen.map((zeile) => (
                <tr
                  key={zeile.poiId}
                  data-testid={`bewertungszeile-${zeile.poiId}`}
                >
                  <td className={styles.name}>{zeile.name}</td>
                  <td>{POI_STATUS_LABEL[zeile.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
