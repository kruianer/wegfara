"use client";

import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde, Stimme } from "@/lib/bewertungen/types";
import type { BewertendePerson } from "@/lib/bewertungen/stand";
import { STIMM_WAHLEN, STIMM_WAHL_LABEL } from "@/lib/bewertungen/types";
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
  stimmen = [],
  personen = [],
}: {
  /** Die POIs der geoeffneten Reise -- an ihnen stehen Name und Status. */
  pois?: Poi[];
  /** Die Bewertungsrunden der geoeffneten Reise (req-054). */
  runden?: Bewertungsrunde[];
  /** Die abgegebenen Stimmen dieser Runden. */
  stimmen?: Stimme[];
  /** Die Teilnehmer der Reise, mit ihrem Anzeigenamen. */
  personen?: BewertendePerson[];
}) {
  const runde = anzuzeigendeRunde(runden);
  const zeilen = runde ? rundenzeilen(runde, pois, stimmen, personen) : [];

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
                {/* Die fünf Stufen in der Reihenfolge des Requirements: von
                    der größten Zustimmung zur Abwesenheit. */}
                {STIMM_WAHLEN.map((wahl) => (
                  <th key={wahl} scope="col" className={styles.numberHead}>
                    {STIMM_WAHL_LABEL[wahl]}
                  </th>
                ))}
                <th scope="col" className={styles.numberHead}>
                  Noch nicht gestimmt
                </th>
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
                  {zeile.stand.verteilung.map((eintrag) => (
                    <td
                      key={eintrag.wahl}
                      className={styles.number}
                      data-testid={`bewertungszeile-wahl-${eintrag.wahl}`}
                      aria-label={`${STIMM_WAHL_LABEL[eintrag.wahl]}: ${zeile.name}`}
                    >
                      {eintrag.anzahl}
                    </td>
                  ))}
                  {/* Wer noch fehlt, entscheidet mit, ob der Stand schon
                      etwas aussagt (req-063). */}
                  <td
                    className={styles.number}
                    data-testid="bewertungszeile-offen"
                    aria-label={`Noch nicht gestimmt: ${zeile.name}`}
                  >
                    {zeile.stand.fehlend.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
