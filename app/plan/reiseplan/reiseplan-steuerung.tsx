"use client";

import type { Activity, DruckDarstellung } from "@/lib/activities/types";
import type { Trip } from "@/lib/trips/types";
import { activitiesForDay } from "@/lib/activities/day";
import {
  DRUCK_DARSTELLUNGEN,
  DRUCK_DARSTELLUNG_LABEL,
  druckDarstellung,
  isDruckDarstellung,
} from "@/lib/activities/druck-darstellung";
import { tripDays } from "@/lib/trips/days";
import { formatLangesDatum } from "@/lib/trips/format";
import styles from "./reiseplan-druck.module.css";

/**
 * Das Kennzeichen je Programmpunkt (req-080): wie er im gedruckten Plan
 * erscheint -- "Vollständig", "Als Nebenstation" oder "Nicht anzeigen".
 *
 * Es steht hier, neben dem Heft, und nicht im Zeitstrahl: entschieden wird
 * es beim Ansehen des Heftes, und die Wirkung ist gleich daneben zu sehen.
 * Gedruckt wird diese Liste nicht -- sie gehoert zum Bildschirm, nicht aufs
 * Papier.
 *
 * Gezeigt werden **alle** Programmpunkte des Tages, auch die mit "Nicht
 * anzeigen": sonst liesse sich ein einmal weggelassener nicht
 * zurueckholen.
 */

export const STEUERUNG_TITEL = "Was ins Heft kommt";

export const STEUERUNG_NICHT_GESPEICHERT =
  "Das Kennzeichen konnte nicht gespeichert werden.";

export function ReiseplanSteuerung({
  trip,
  activities,
  onSetze,
  fehler = false,
}: {
  trip: Trip;
  /** Alle Programmpunkte der Reise -- auch die, die im Heft fehlen. */
  activities: Activity[];
  onSetze: (activity: Activity, darstellung: DruckDarstellung) => void;
  /** Ob das letzte Speichern fehlschlug (bug-021). */
  fehler?: boolean;
}) {
  const tage = tripDays(trip);

  return (
    <div className={styles.nurBildschirm} data-testid="druck-steuerung">
      <h2>{STEUERUNG_TITEL}</h2>
      <p>
        Je Programmpunkt ist hier eingestellt, wie er im gedruckten Plan
        erscheint. Das wirkt <strong>nur auf dieses Heft</strong> — in der App
        bleibt jeder Programmpunkt sichtbar, gleich was hier steht.
      </p>
      {fehler && (
        <p className={styles.steuerungFehler} role="alert">
          {STEUERUNG_NICHT_GESPEICHERT}
        </p>
      )}
      {tage.map((tag, index) => {
        const desTages = activitiesForDay(activities, trip.id, tag.date);
        if (desTages.length === 0) return null;
        return (
          <div key={tag.date} className={styles.steuerungTag}>
            <h3>
              Tag {index + 1} · {formatLangesDatum(tag.date)}
            </h3>
            {desTages.map((activity) => (
              <label key={activity.id} className={styles.steuerungZeile}>
                <span className={styles.steuerungZeit}>
                  {activity.startAt.slice(11, 16)}
                </span>
                <span className={styles.steuerungName}>{activity.title}</span>
                <select
                  className={styles.steuerungWahl}
                  data-testid={`druck-darstellung-${activity.id}`}
                  value={druckDarstellung(activity)}
                  onChange={(event) => {
                    const wert = event.target.value;
                    if (isDruckDarstellung(wert)) onSetze(activity, wert);
                  }}
                >
                  {DRUCK_DARSTELLUNGEN.map((darstellung) => (
                    <option key={darstellung} value={darstellung}>
                      {DRUCK_DARSTELLUNG_LABEL[darstellung]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
