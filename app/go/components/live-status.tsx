"use client";

import { useMemo } from "react";
import type { Activity } from "@/lib/activities/types";
import { planEintragZu } from "@/lib/live-status/plan-eintrag";
import type { Standortlage } from "@/lib/live-status/types";
import { verzugText } from "@/lib/live-status/verzug";
import { uhrzeit } from "@/lib/live-status/zeit";
import styles from "./live-status.module.css";

const KEIN_PROGRAMMPUNKT = "Nichts mehr für heute geplant";

/**
 * Der Live-Status ueber dem Plan (req-051): wo die Gruppe laut Plan gerade
 * sein muesste, wo sie laut GPS ist, und wie viel Verzug daraus folgt.
 *
 * Uhr und Lage kommen vom Aufrufer (siehe use-live-lage.ts) -- dieselben,
 * aus denen der Zeitstrahl seine Linien zeichnet (req-086).
 *
 * Ob er ueberhaupt erscheint, entscheidet der Aufrufer (siehe
 * lib/live-status/sichtbar.ts) -- ausserhalb der Reise gibt es ihn nicht,
 * auch nicht als leeren Platzhalter.
 */
export function LiveStatus({
  activities,
  zeit,
  lage,
}: {
  /** Die Programmpunkte der Reise -- nicht nur die des gewaehlten Tages. */
  activities: Activity[];
  /** Die laufende lokale Zeit "YYYY-MM-DDTHH:mm". */
  zeit: string;
  /** Ort und Verzug vom Server. */
  lage: Standortlage;
}) {
  const eintrag = useMemo(
    () => planEintragZu(activities, zeit),
    [activities, zeit],
  );

  // Der Verzug gehoert zum Programmpunkt unter "Laut Plan" -- dem laufenden
  // oder dem naechsten (req-084). Ist heute nichts mehr geplant, gibt es
  // auch keinen.
  const text = eintrag ? verzugText(lage.verzug) : null;
  const pille = lage.verzug.art !== "unbekannt";

  return (
    <section className={styles.card} aria-label="Live-Status">
      <div className={styles.head}>
        <span className={styles.eyebrow}>
          LIVE-STATUS · {uhrzeit(zeit)} UHR
        </span>
        {text !== null &&
          (pille ? (
            <span
              className={`${styles.pill} ${
                lage.verzug.art === "verspaetet"
                  ? styles.verspaetet
                  : styles.imZeitplan
              }`}
            >
              {text}
            </span>
          ) : (
            <span className={styles.hinweis}>{text}</span>
          ))}
      </div>
      <div className={styles.columns}>
        <div className={styles.column}>
          <span className={styles.label}>Laut Plan</span>
          <span className={styles.value}>
            {eintrag ? eintrag.activity.title : KEIN_PROGRAMMPUNKT}
          </span>
          {eintrag?.art === "naechster" && (
            <span className={styles.zeit}>
              ab {uhrzeit(eintrag.activity.startAt)}
            </span>
          )}
        </div>
        {lage.ort !== null && (
          <div className={styles.column}>
            <span className={styles.label}>Laut GPS</span>
            <span className={styles.value}>
              <span className={styles.gpsDot} aria-hidden="true" />
              {lage.ort}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
