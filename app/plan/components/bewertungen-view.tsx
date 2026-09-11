"use client";

import type { Bewertungsrunde } from "@/lib/bewertungen/types";
import { anzuzeigendeRunde } from "@/lib/bewertungen/rundenstand";
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
  runden = [],
}: {
  /** Die Bewertungsrunden der geoeffneten Reise (req-054). */
  runden?: Bewertungsrunde[];
}) {
  const runde = anzuzeigendeRunde(runden);

  return (
    <section className={styles.area} aria-label="Bewertungen">
      <div className={styles.head}>
        <h2 className={styles.title}>Bewertungen</h2>
      </div>
      {!runde && <p className={styles.empty}>{KEINE_RUNDE_HINWEIS}</p>}
    </section>
  );
}
