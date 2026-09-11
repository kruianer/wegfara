"use client";

import { Fragment, useState } from "react";
import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde, Stimme } from "@/lib/bewertungen/types";
import type { BewertendePerson } from "@/lib/bewertungen/stand";
import { STIMM_WAHLEN, STIMM_WAHL_LABEL } from "@/lib/bewertungen/types";
import { POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import {
  anzuzeigendeRunde,
  rundenzeilen,
  type RundenZeile,
} from "@/lib/bewertungen/rundenstand";
import styles from "./bewertungen-view.module.css";

/** Was dort steht, wo es noch nie eine Runde gab (req-063). */
export const KEINE_RUNDE_HINWEIS =
  "Noch keine Bewertungsrunde. Im Bereich POIs lässt sich eine starten.";

/**
 * Wie viele Spalten eine Zeile hat -- POI, Status, die fuenf Stufen, die noch
 * offenen Stimmen und die Zustimmung. Die aufgeklappten Namen stehen darunter
 * in einer Zeile ueber alle Spalten.
 */
const SPALTEN = 4 + STIMM_WAHLEN.length;

/**
 * Wer wie gestimmt hat -- die aufgeklappte Zeile (req-063). Genannt wird
 * jede Stufe, für die es Stimmen gibt, mit den Namen dahinter; zuletzt, wer
 * noch nicht gestimmt hat.
 *
 * Alle sehen alle Stimmen mit Namen (req-054) -- der Planer steht ohnehin
 * nur Reiseleitern und Account-Admins offen (req-055).
 */
function Namen({ zeile }: { zeile: RundenZeile }) {
  const { abgegeben, fehlend } = zeile.stand;

  return (
    <dl className={styles.namen}>
      {STIMM_WAHLEN.filter((wahl) =>
        abgegeben.some((stimme) => stimme.wahl === wahl),
      ).map((wahl) => (
        <div key={wahl} className={styles.namenZeile}>
          <dt className={styles.namenLabel}>{STIMM_WAHL_LABEL[wahl]}</dt>
          <dd className={styles.namenWert}>
            {abgegeben
              .filter((stimme) => stimme.wahl === wahl)
              .map((stimme) => stimme.name)
              .join(", ")}
          </dd>
        </div>
      ))}
      {abgegeben.length === 0 && (
        <div className={styles.namenZeile}>
          <dt className={styles.namenLabel}>Stimmen</dt>
          <dd className={styles.namenWert}>Noch keine</dd>
        </div>
      )}
      {fehlend.length > 0 && (
        <div className={styles.namenZeile}>
          <dt className={styles.namenLabel}>Noch nicht gestimmt</dt>
          <dd className={styles.namenWert}>
            {fehlend.map((person) => person.name).join(", ")}
          </dd>
        </div>
      )}
    </dl>
  );
}

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
  // Welche Zeilen ihre Namen zeigen. Zugeklappt steht in der Zeile nur die
  // Zahl je Stufe -- wer wie gestimmt hat, braucht Platz und ist nicht bei
  // jeder Entscheidung gefragt.
  const [offene, setOffene] = useState<string[]>([]);

  function klappe(poiId: string) {
    setOffene((current) =>
      current.includes(poiId)
        ? current.filter((id) => id !== poiId)
        : [...current, poiId],
    );
  }

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
                {/* Danach ist sortiert -- ohne die Zahl daneben bliebe die
                    Reihenfolge unerklärt. */}
                <th scope="col" className={styles.numberHead}>
                  Zustimmung
                </th>
              </tr>
            </thead>
            <tbody data-testid="bewertungszeilen">
              {zeilen.map((zeile) => {
                const offen = offene.includes(zeile.poiId);
                return (
                  <Fragment key={zeile.poiId}>
                    <tr data-testid={`bewertungszeile-${zeile.poiId}`}>
                      <td className={styles.name}>
                        {/* Ein Klick auf den Namen klappt die Namen der
                            Stimmen auf (req-063) -- so wie in der POI-Liste
                            das Formular. */}
                        <button
                          type="button"
                          className={styles.nameButton}
                          aria-expanded={offen}
                          onClick={() => klappe(zeile.poiId)}
                        >
                          {zeile.name}
                        </button>
                      </td>
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
                      <td
                        className={`${styles.number} ${styles.zustimmung}`}
                        data-testid="bewertungszeile-zustimmung"
                        aria-label={`Zustimmung: ${zeile.name}`}
                      >
                        {zeile.zustimmung}
                      </td>
                    </tr>
                    {offen && (
                      <tr data-testid={`bewertungsdetail-${zeile.poiId}`}>
                        <td colSpan={SPALTEN} className={styles.detail}>
                          <Namen zeile={zeile} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
