"use client";

import { useRef } from "react";
import type { Activity } from "@/lib/activities/types";
import { formatTimeRange } from "@/lib/activities/format";
import { ActivityCard } from "./activity-card";
import styles from "./activity-option-group.module.css";

export function ActivityOptionGroup({
  activities,
  selectedId,
  onSelect,
  readOnly = false,
}: {
  activities: Activity[];
  selectedId: string;
  onSelect: (activityId: string) => void;
  /**
   * Ein Gast sieht die gewaehlte Alternative, waehlt aber nicht (req-038):
   * die Bedienelemente zum Aendern fehlen bei ihm ganz.
   */
  readOnly?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Erkennt die eingerastete Karte beim Wischen (scroll-snap) und
  // uebernimmt sie als Wahl — siehe Interactions & Behavior der Vorlage.
  function handleScroll() {
    if (readOnly) return;
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const activity = activities[index];
    if (activity && activity.id !== selectedId) {
      onSelect(activity.id);
    }
  }

  // Fuer den Gast bleibt die gewaehlte Alternative -- als Karte, ohne
  // Wischleiste und ohne Punkte.
  if (readOnly) {
    const selected =
      activities.find((activity) => activity.id === selectedId) ??
      activities[0];
    return (
      <div className={styles.group}>
        <div className={styles.header}>
          <span className={styles.count}>
            {activities.length} OPTIONEN · {formatTimeRange(activities[0])}
          </span>
        </div>
        <div className={styles.track}>
          <div className={styles.slide}>
            <ActivityCard activity={selected} selected />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.group}>
      <div className={styles.header}>
        <span className={styles.count}>
          {activities.length} OPTIONEN · {formatTimeRange(activities[0])}
        </span>
        <span className={styles.hint}>Zum Wählen wischen</span>
      </div>
      <div
        className={styles.track}
        ref={trackRef}
        onScroll={handleScroll}
        role="group"
        aria-label="Optionen zum Wischen"
      >
        {activities.map((activity) => (
          <div key={activity.id} className={styles.slide}>
            <ActivityCard
              activity={activity}
              selected={activity.id === selectedId}
            />
          </div>
        ))}
      </div>
      <div
        className={styles.dots}
        role="group"
        aria-label={`${activities.length} Optionen`}
      >
        {activities.map((activity, index) => (
          <button
            key={activity.id}
            type="button"
            className={`${styles.dot} ${
              activity.id === selectedId ? styles.dotActive : ""
            }`}
            aria-label={`Option ${index + 1} von ${activities.length}`}
            aria-pressed={activity.id === selectedId}
            onClick={() => onSelect(activity.id)}
          />
        ))}
      </div>
    </div>
  );
}
