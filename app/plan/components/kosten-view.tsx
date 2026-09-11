"use client";

import { useMemo } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import { kostenzeilen } from "@/lib/kosten/zeilen";
import { formatKosten } from "@/lib/pois/kosten";
import styles from "./kosten-view.module.css";

/** Ein Betrag in Cent, wie er in der Tabelle steht: „12,50 €". */
function betrag(cent: number | null): string {
  return cent === null ? "—" : `${formatKosten(cent)} €`;
}

/**
 * Der Bereich "Kosten" des Planers (req-062): die Kostenplanung einer Reise
 * -- was sie kosten wird, insgesamt und je Person.
 *
 * Je Programmpunkt eine Zeile, automatisch aus dem Zeitstrahl. Preis und
 * Buchungsstatus stehen am POI (req-061) und werden von dort gelesen -- die
 * Tabelle haelt keine zweite Kopie.
 *
 * Die Kostenplanung ist die Kalkulation **vorher**; die Ausgaben (req-029)
 * im Begleiter bleiben davon getrennt -- sie erfassen, was unterwegs
 * tatsaechlich gezahlt wurde.
 */
export function KostenView({
  trip,
  activities,
  pois,
  teilnehmerzahl,
}: {
  trip: Trip;
  /** Die Programmpunkte der geoeffneten Reise. */
  activities: Activity[];
  /** Die POIs der geoeffneten Reise -- an ihnen stehen Preis und Buchung. */
  pois: Poi[];
  /** Wie viele Personen mitfahren -- die Vorbelegung der Anzahl. */
  teilnehmerzahl: number;
}) {
  const zeilen = useMemo(
    () => kostenzeilen({ trip, activities, pois, teilnehmerzahl }),
    [trip, activities, pois, teilnehmerzahl],
  );

  return (
    <section className={styles.area} aria-label="Kosten">
      <div className={styles.head}>
        <h2 className={styles.title}>Kosten</h2>
      </div>
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
                  <td className={styles.number} data-testid="kostenzeile-preis">
                    {betrag(zeile.preisCent)}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
