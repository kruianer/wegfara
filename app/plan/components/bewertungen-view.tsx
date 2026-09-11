"use client";

import { Fragment, useState } from "react";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import type { Bewertungsrunde, Stimme } from "@/lib/bewertungen/types";
import type { BewertendePerson } from "@/lib/bewertungen/stand";
import { STIMM_WAHLEN, STIMM_WAHL_LABEL } from "@/lib/bewertungen/types";
import { POI_STATUSES, POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import { beendeBewertungsrunde } from "@/lib/bewertungen/save";
import {
  anzuzeigendeRunde,
  rundenzeilen,
  type RundenZeile,
} from "@/lib/bewertungen/rundenstand";
import { usePoiStatus } from "./use-poi-status";
import styles from "./bewertungen-view.module.css";

/** Was dort steht, wo es noch nie eine Runde gab (req-063). */
export const KEINE_RUNDE_HINWEIS =
  "Noch keine Bewertungsrunde. Im Bereich POIs lässt sich eine starten.";

/** Was zu melden ist, wenn das Beenden nicht ankam. */
export const NICHT_BEENDET = "Die Runde konnte nicht beendet werden.";

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
  istReiseleiter = false,
  onPoisChanged = () => {},
  onRundeBeendet = () => {},
}: {
  /** Die POIs der geoeffneten Reise -- an ihnen stehen Name und Status. */
  pois?: Poi[];
  /** Die Bewertungsrunden der geoeffneten Reise (req-054). */
  runden?: Bewertungsrunde[];
  /** Die abgegebenen Stimmen dieser Runden. */
  stimmen?: Stimme[];
  /** Die Teilnehmer der Reise, mit ihrem Anzeigenamen. */
  personen?: BewertendePerson[];
  /**
   * Ob die angemeldete Person die geoeffnete Reise fuehrt (req-054) -- nur
   * sie beendet die Runde. Geprueft wird das serverseitig (siehe
   * lib/db/rating-rounds.ts).
   */
  istReiseleiter?: boolean;
  /**
   * Ein POI mit geaendertem Status (req-063) -- gespeichert ist er da
   * bereits. Er traegt den Status danach auch im Bereich POIs: es gibt eine
   * Wahrheit, an zwei Stellen bedienbar.
   */
  onPoisChanged?: (pois: Poi[]) => void;
  /** Eine beendete Runde (req-054) -- gespeichert ist sie da bereits. */
  onRundeBeendet?: (runde: Bewertungsrunde) => void;
}) {
  const runde = anzuzeigendeRunde(runden);
  const zeilen = runde ? rundenzeilen(runde, pois, stimmen, personen) : [];
  // Welche Zeilen ihre Namen zeigen. Zugeklappt steht in der Zeile nur die
  // Zahl je Stufe -- wer wie gestimmt hat, braucht Platz und ist nicht bei
  // jeder Entscheidung gefragt.
  const [offene, setOffene] = useState<string[]>([]);
  // Denselben Status setzt die POI-Liste (req-010); beide nutzen dieselbe
  // Behandlung eines fehlgeschlagenen Speicherns (bug-021).
  const { statusProblem, setzeStatus } = usePoiStatus(pois, onPoisChanged);
  // Das Beenden ist ein Vorgang, dessen Ausgang der Nutzer sehen muss
  // (req-054): solange er laeuft, ist der Knopf unwirksam, und misslingt er,
  // steht es da.
  const [beendend, setBeendend] = useState(false);
  const [rundenProblem, setRundenProblem] = useState<string | null>(null);
  const laeuft = runde?.status === "laeuft";

  function klappe(poiId: string) {
    setOffene((current) =>
      current.includes(poiId)
        ? current.filter((id) => id !== poiId)
        : [...current, poiId],
    );
  }

  /**
   * Beendet die laufende Runde (req-063). Danach bleiben ihre Stimmen
   * sichtbar, neue kommen nicht mehr dazu (req-054).
   */
  async function beende() {
    if (!runde) return;
    setBeendend(true);
    const gespeichert = await beendeBewertungsrunde(runde.id);
    setBeendend(false);
    if (!gespeichert) {
      setRundenProblem(NICHT_BEENDET);
      return;
    }
    setRundenProblem(null);
    onRundeBeendet(gespeichert);
  }

  return (
    <section className={styles.area} aria-label="Bewertungen">
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <h2 className={styles.title}>Bewertungen</h2>
          {/* Ob die gezeigte Runde noch laeuft -- sonst bliebe offen, warum
              hier Stimmen stehen, aber keine mehr dazukommen (req-054). */}
          {runde && (
            <span className={styles.badge} data-testid="runden-status">
              {laeuft ? "Runde läuft" : "Runde beendet"}
            </span>
          )}
        </div>
        {/* Nur bei laufender Runde und nur fuer den Reiseleiter (req-063).
            Danach bleiben die Stimmen sichtbar. */}
        {laeuft && istReiseleiter && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void beende()}
            disabled={beendend}
          >
            Runde beenden
          </button>
        )}
      </div>
      {(statusProblem || rundenProblem) && (
        <p className={styles.error} role="alert">
          {statusProblem ?? rundenProblem}
        </p>
      )}
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
                      <td>
                        {/* Die Entscheidung trifft der Reiseleiter, hier
                            neben den Stimmen (req-063) -- sie folgt nie von
                            selbst aus ihnen (req-054). Derselbe Status wie
                            in der POI-Liste; was hier steht, steht dort. */}
                        <select
                          className={styles.statusSelect}
                          aria-label={`Status von ${zeile.name}`}
                          value={zeile.status}
                          onChange={(event) =>
                            void setzeStatus(
                              zeile.poiId,
                              event.target.value as PoiStatus,
                            )
                          }
                        >
                          {POI_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {POI_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </td>
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
