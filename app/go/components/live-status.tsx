"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity } from "@/lib/activities/types";
import { ladeStandortlage } from "@/lib/live-status/lade-standortlage";
import { planEintragZu } from "@/lib/live-status/plan-eintrag";
import { OHNE_STANDORT, type Standortlage } from "@/lib/live-status/types";
import { verzugText } from "@/lib/live-status/verzug";
import { lokaleZeit, uhrzeit } from "@/lib/live-status/zeit";
import styles from "./live-status.module.css";

/** Wie oft die Uhr weiterspringt -- fein genug fuer eine Anzeige in Minuten. */
const UHR_INTERVALL_MS = 20_000;

/** Wie oft Ort und Verzug neu beim Server erfragt werden. */
const LAGE_INTERVALL_MS = 60_000;

const KEIN_PROGRAMMPUNKT = "Nichts mehr für heute geplant";

/**
 * Der Live-Status ueber dem Plan (req-051): wo die Gruppe laut Plan gerade
 * sein muesste, wo sie laut GPS ist, und wie viel Verzug daraus folgt.
 *
 * Ob er ueberhaupt erscheint, entscheidet der Aufrufer (siehe
 * lib/live-status/sichtbar.ts) -- ausserhalb der Reise gibt es ihn nicht,
 * auch nicht als leeren Platzhalter.
 */
export function LiveStatus({
  tripId,
  activities,
  jetzt,
}: {
  tripId: string;
  /** Die Programmpunkte der Reise -- nicht nur die des gewaehlten Tages. */
  activities: Activity[];
  /**
   * Die lokale Zeit "YYYY-MM-DDTHH:mm" beim Aufbau der Seite. Sie kommt vom
   * Server, damit die erste Darstellung im Browser dieselbe ist; danach
   * laeuft die Uhr im Geraet weiter.
   */
  jetzt: string;
}) {
  const [zeit, setZeit] = useState(jetzt);
  const [lage, setLage] = useState<Standortlage>(OHNE_STANDORT);

  useEffect(() => {
    const uhr = setInterval(
      () => setZeit(lokaleZeit(new Date())),
      UHR_INTERVALL_MS,
    );
    return () => clearInterval(uhr);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let laufend = true;

    async function holen() {
      const geladen = await ladeStandortlage(tripId, controller.signal);
      if (laufend) setLage(geladen);
    }

    void holen();
    const takt = setInterval(() => void holen(), LAGE_INTERVALL_MS);
    return () => {
      laufend = false;
      controller.abort();
      clearInterval(takt);
    };
  }, [tripId]);

  const eintrag = useMemo(
    () => planEintragZu(activities, zeit),
    [activities, zeit],
  );

  // Der Verzug gehoert zum laufenden Programmpunkt: steht keiner an, wird
  // auch keiner angezeigt (req-051).
  const text = eintrag?.art === "laufend" ? verzugText(lage.verzug) : null;
  const pille =
    lage.verzug.art === "im_zeitplan" || lage.verzug.art === "verspaetet";

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
                lage.verzug.art === "im_zeitplan"
                  ? styles.imZeitplan
                  : styles.verspaetet
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
