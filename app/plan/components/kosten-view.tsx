"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi, PoiBuchung } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { GespeicherteKostenzeile, Kostenzeile } from "@/lib/kosten/types";
import { kostenzeilen } from "@/lib/kosten/zeilen";
import { saveKostenzeile, type Zeilenziel } from "@/lib/kosten/save-zeile";
import { POI_BUCHUNGEN, POI_BUCHUNG_LABEL } from "@/lib/pois/buchung";
import { formatKosten, parseKosten } from "@/lib/pois/kosten";
import styles from "./kosten-view.module.css";

/** Ein Betrag in Cent, wie er in der Tabelle steht: „12,50 €". */
function betrag(cent: number | null): string {
  return cent === null ? "—" : `${formatKosten(cent)} €`;
}

/** Der Preis einer Zeile als Eingabe: „12,50"; leer heisst "nicht eingetragen". */
function preisEingabe(cent: number | null): string {
  return cent === null ? "" : formatKosten(cent);
}

/** Welche Zeile beim Speichern gemeint ist (siehe lib/kosten/save-zeile.ts). */
function ziel(zeile: Kostenzeile): Zeilenziel {
  return zeile.activityId ? { activityId: zeile.activityId } : { id: zeile.id };
}

const PREIS_UNGUELTIG =
  "Der Preis muss ein Betrag in Euro sein, zum Beispiel 12,50.";
const NICHT_GESPEICHERT = "Das konnte nicht gespeichert werden.";

/**
 * Der Bereich "Kosten" des Planers (req-062): die Kostenplanung einer Reise
 * -- was sie kosten wird, insgesamt und je Person.
 *
 * Je Programmpunkt eine Zeile, automatisch aus dem Zeitstrahl. Preis und
 * Buchungsstatus stehen am POI (req-061); hier werden sie angezeigt und
 * geaendert und fliessen in den POI zurueck -- es gibt eine Wahrheit, an
 * zwei Stellen bedienbar. Eine zweite Kopie haelt die Tabelle nicht.
 *
 * Die Kostenplanung ist die Kalkulation **vorher**; die Ausgaben (req-029)
 * im Begleiter bleiben davon getrennt -- sie erfassen, was unterwegs
 * tatsaechlich gezahlt wurde.
 */
export function KostenView({
  trip,
  activities,
  pois,
  gespeicherte,
  teilnehmerzahl,
  onPoiChanged,
  onZeileGespeichert,
}: {
  trip: Trip;
  /** Die Programmpunkte der geoeffneten Reise. */
  activities: Activity[];
  /** Die POIs der geoeffneten Reise -- an ihnen stehen Preis und Buchung. */
  pois: Poi[];
  /** Was zu den Zeilen dieser Reise gespeichert ist. */
  gespeicherte: GespeicherteKostenzeile[];
  /** Wie viele Personen mitfahren -- die Vorbelegung der Anzahl. */
  teilnehmerzahl: number;
  /** Ein geaenderter POI -- er steht danach auch im Bereich POIs richtig. */
  onPoiChanged: (poi: Poi) => void;
  /** Eine gespeicherte Zeile (Programmpunkt ohne POI oder manuelle Zeile). */
  onZeileGespeichert: (zeile: GespeicherteKostenzeile) => void;
}) {
  const zeilen = useMemo(
    () =>
      kostenzeilen({ trip, activities, pois, gespeicherte, teilnehmerzahl }),
    [trip, activities, pois, gespeicherte, teilnehmerzahl],
  );
  // Was gerade in einem Preisfeld steht, solange es bearbeitet wird. Nach dem
  // Speichern faellt die Zeile wieder auf den gespeicherten Stand zurueck.
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);

  function vergiss(zeilenId: string) {
    setEntwuerfe((current) => {
      if (!(zeilenId in current)) return current;
      const rest = { ...current };
      delete rest[zeilenId];
      return rest;
    });
  }

  async function speicherePreis(zeile: Kostenzeile, eingabe: string) {
    const gelesen = parseKosten(eingabe);
    if (gelesen === "ungueltig") {
      setProblem(PREIS_UNGUELTIG);
      return;
    }
    // Unveraendert: kein Schreibvorgang, keine Meldung.
    if (gelesen === zeile.preisCent) {
      vergiss(zeile.id);
      setProblem(null);
      return;
    }

    const antwort = await saveKostenzeile(ziel(zeile), { preis: eingabe });
    if (!antwort) {
      setProblem(NICHT_GESPEICHERT);
      return;
    }
    setProblem(null);
    vergiss(zeile.id);
    if (antwort.poi) onPoiChanged(antwort.poi);
    if (antwort.zeile) onZeileGespeichert(antwort.zeile);
  }

  async function speichereBuchung(zeile: Kostenzeile, buchung: PoiBuchung) {
    const antwort = await saveKostenzeile(ziel(zeile), { buchung });
    if (!antwort) {
      setProblem(NICHT_GESPEICHERT);
      return;
    }
    setProblem(null);
    if (antwort.poi) onPoiChanged(antwort.poi);
    if (antwort.zeile) onZeileGespeichert(antwort.zeile);
  }

  return (
    <section className={styles.area} aria-label="Kosten">
      <div className={styles.head}>
        <h2 className={styles.title}>Kosten</h2>
      </div>
      {problem && (
        <p className={styles.error} role="alert" data-testid="kosten-hinweis">
          {problem}
        </p>
      )}
      {zeilen.length === 0 ? (
        <p className={styles.empty}>Noch keine Kosten erfasst.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Kostenplanung">
            <thead>
              <tr>
                <th scope="col">Bezeichnung</th>
                <th scope="col" className={styles.numberHead}>
                  Preis je Person
                </th>
                <th scope="col" className={styles.numberHead}>
                  Anzahl
                </th>
                <th scope="col" className={styles.numberHead}>
                  Gesamt
                </th>
                <th scope="col">Buchung</th>
              </tr>
            </thead>
            <tbody data-testid="kostenzeilen">
              {zeilen.map((zeile) => (
                <tr key={zeile.id} data-testid={`kostenzeile-${zeile.id}`}>
                  <td>
                    <span className={styles.bezeichnung}>
                      {zeile.bezeichnung}
                    </span>
                    {zeile.reisetag && (
                      <span className={styles.reisetag}>{zeile.reisetag}</span>
                    )}
                  </td>
                  <td className={styles.number}>
                    {/* Derselbe Betrag wie im POI-Formular (req-061), hier
                        nur naeher dran: was hier steht, steht dort. */}
                    <input
                      className={`${styles.input} ${styles.numberInput}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="z.B. 12,50"
                      aria-label={`Preis je Person: ${zeile.bezeichnung}`}
                      value={
                        entwuerfe[zeile.id] ?? preisEingabe(zeile.preisCent)
                      }
                      onChange={(event) =>
                        setEntwuerfe((current) => ({
                          ...current,
                          [zeile.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) =>
                        void speicherePreis(zeile, event.target.value)
                      }
                    />
                  </td>
                  <td
                    className={styles.number}
                    data-testid="kostenzeile-anzahl"
                  >
                    {zeile.anzahl}
                  </td>
                  <td
                    className={styles.number}
                    data-testid="kostenzeile-gesamt"
                  >
                    {betrag(zeile.gesamtCent)}
                  </td>
                  <td>
                    <select
                      className={`${styles.input} ${styles.select}`}
                      aria-label={`Buchung: ${zeile.bezeichnung}`}
                      value={zeile.buchung}
                      onChange={(event) =>
                        void speichereBuchung(
                          zeile,
                          event.target.value as PoiBuchung,
                        )
                      }
                    >
                      {POI_BUCHUNGEN.map((buchung) => (
                        <option key={buchung} value={buchung}>
                          {POI_BUCHUNG_LABEL[buchung]}
                        </option>
                      ))}
                    </select>
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
