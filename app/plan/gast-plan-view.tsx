"use client";

import { useMemo } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { formatDateRange } from "@/lib/trips/format";
import { POI_STATUS_COLOR, POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import { POI_TYPE_LABEL } from "@/lib/pois/type-meta";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import { useWindowWidth } from "./use-window-width";
import { PlanungView } from "./components/planung-view";
import { NarrowNotice } from "./components/narrow-notice";
import styles from "./gast-plan-view.module.css";

/**
 * Der Planer, wie ihn ein Gast sieht (req-038): Plan, Programmpunkte und
 * POIs genau einer Reise -- und nichts darueber hinaus.
 *
 * Alle Bedienelemente zum Aendern fehlen: es gibt keinen Kopfbereich mit
 * Bereichen, keinen Reisewechsel, keine Karten "Nutzer", "Gastzugaenge",
 * "Mein Bereich" oder "Verwaltung", keine Kosten, keine Dokumente. Das ist
 * die Anzeige; der Schutz liegt darin, dass eine Gast-Sitzung keine
 * Teilnehmer-Sitzung ist und jede schreibende Schnittstelle sie abweist.
 */
export function GastPlanView({
  trip,
  pois = [],
  activities = [],
  transfers = [],
  optionSelections = {},
  today,
}: {
  trip: Trip;
  pois?: Poi[];
  activities?: Activity[];
  transfers?: Transfer[];
  optionSelections?: Record<string, string>;
  today: string;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);
  const windowWidth = useWindowWidth();

  if (windowWidth < PLANNER_MIN_WIDTH_PX) return <NarrowNotice />;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>{trip.title}</div>
          <div className={styles.dates}>{formatDateRange(trip)}</div>
        </div>
        <span className={styles.badge}>Gastzugang · nur lesen</span>
      </header>
      <main className={styles.content}>
        <PlanungView
          trip={trip}
          pois={pois}
          activities={activities}
          transfers={transfers}
          optionSelections={optionSelections}
          today={todayDate}
        />
        <section className={styles.poiCard} aria-label="POIs">
          <h2 className={styles.poiTitle}>
            POIs
            <span className={styles.poiCount}>{` · ${pois.length}`}</span>
          </h2>
          {pois.length === 0 ? (
            <p className={styles.empty}>Noch keine POIs gesammelt.</p>
          ) : (
            <ul className={styles.poiList}>
              {pois.map((poi) => (
                <li
                  key={poi.id}
                  className={styles.poiRow}
                  data-testid={`gast-poi-${poi.id}`}
                >
                  <span
                    className={styles.statusDot}
                    style={{ background: POI_STATUS_COLOR[poi.status] }}
                    aria-hidden="true"
                    title={POI_STATUS_LABEL[poi.status]}
                  />
                  <span className={styles.poiName}>{poi.name}</span>
                  <span className={styles.poiMeta}>
                    {poi.ort} · {POI_TYPE_LABEL[poi.type]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
