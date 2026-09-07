"use client";

import { useState } from "react";
import type { Poi } from "@/lib/pois/types";
import {
  STIMM_WAHLEN,
  STIMM_WAHL_LABEL,
  type Bewertungsrunde as Runde,
  type Stimme,
  type StimmWahl,
} from "@/lib/bewertungen/types";
import {
  bewertungsstand,
  type BewertendePerson,
} from "@/lib/bewertungen/stand";
import { speichereStimme } from "@/lib/bewertungen/save";
import { poiOrtUndTyp } from "@/lib/pois/meta-line";
import styles from "./bewertungsrunde.module.css";

/**
 * Die laufende Bewertungsrunde im Begleiter (req-054): je POI die eigene
 * Stimme -- eine von fuenf --, dazu die Stimmen der anderen mit Namen und
 * wer noch fehlt.
 *
 * Solange die Runde laeuft, laesst sich die eigene Stimme aendern. Ist sie
 * beendet, steht sie hier gar nicht mehr; ihre Stimmen bleiben am POI im
 * Planer sichtbar.
 */
export function Bewertungsrunde({
  runde,
  pois,
  stimmen: initialStimmen,
  personen,
  selfParticipantId,
}: {
  runde: Runde;
  /** Die POIs dieser Runde -- in der Reihenfolge der Runde. */
  pois: Poi[];
  stimmen: Stimme[];
  /** Die Teilnehmer der Reise, mit ihrem Anzeigenamen. */
  personen: BewertendePerson[];
  selfParticipantId: string;
}) {
  // Die eigene Stimme steht sofort, ohne Neuladen. Gespeichert wird sie
  // dabei nicht optimistisch: erst die Antwort des Servers uebernimmt sie --
  // eine Stimme, die nur im Geraet steht, waere fuer die Gruppe keine.
  const [stimmen, setStimmen] = useState(initialStimmen);
  const [laufend, setLaufend] = useState<string | null>(null);

  async function stimmeAb(poiId: string, wahl: StimmWahl) {
    if (laufend) return;
    setLaufend(poiId);
    const gespeichert = await speichereStimme(runde.id, poiId, wahl);
    setLaufend(null);
    if (!gespeichert) return;
    setStimmen((current) => [
      ...current.filter(
        (stimme) =>
          !(
            stimme.roundId === gespeichert.roundId &&
            stimme.poiId === gespeichert.poiId &&
            stimme.participantId === gespeichert.participantId
          ),
      ),
      gespeichert,
    ]);
  }

  return (
    <section className={styles.card} aria-label="Bewertungsrunde">
      <div className={styles.head}>
        <span className={styles.eyebrow}>BEWERTUNGSRUNDE</span>
        <span className={styles.zaehler}>
          {pois.length} {pois.length === 1 ? "POI" : "POIs"}
        </span>
      </div>
      <ul className={styles.liste}>
        {pois.map((poi) => {
          const stand = bewertungsstand(
            poi.id,
            [runde],
            stimmen,
            personen,
            selfParticipantId,
          );
          return (
            <li
              key={poi.id}
              className={styles.eintrag}
              data-testid={`bewertung-${poi.id}`}
            >
              <p className={styles.name}>{poi.name}</p>
              <p className={styles.meta}>{poiOrtUndTyp(poi)}</p>
              <div
                className={styles.wahlen}
                role="group"
                aria-label={`Stimme zu ${poi.name}`}
              >
                {STIMM_WAHLEN.map((wahl) => {
                  const gewaehlt = stand?.eigeneWahl === wahl;
                  return (
                    <button
                      key={wahl}
                      type="button"
                      className={`${styles.wahl} ${gewaehlt ? styles.wahlAktiv : ""}`}
                      aria-pressed={gewaehlt}
                      disabled={laufend === poi.id}
                      onClick={() => stimmeAb(poi.id, wahl)}
                    >
                      {STIMM_WAHL_LABEL[wahl]}
                    </button>
                  );
                })}
              </div>
              {stand && stand.abgegeben.length > 0 && (
                <p className={styles.zeile}>
                  Stimmen:{" "}
                  {stand.abgegeben
                    .map(
                      (stimme) =>
                        `${stimme.name} — ${STIMM_WAHL_LABEL[stimme.wahl]}`,
                    )
                    .join(" · ")}
                </p>
              )}
              {stand && stand.fehlend.length > 0 && (
                <p className={styles.zeile}>
                  Fehlt noch:{" "}
                  {stand.fehlend.map((person) => person.name).join(", ")}
                </p>
              )}
              {stand && stand.ohneMich.length > 0 && (
                <p className={`${styles.zeile} ${styles.ohneMich}`}>
                  Nicht dabei:{" "}
                  {stand.ohneMich.map((person) => person.name).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
