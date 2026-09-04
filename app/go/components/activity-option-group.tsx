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
}: {
  activities: Activity[];
  selectedId: string;
  onSelect: (activityId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Erkennt die eingerastete Karte beim Wischen (scroll-snap) und
  // uebernimmt sie als Wahl — siehe Interactions & Behavior der Vorlage.
  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const activity = activities[index];
    if (activity && activity.id !== selectedId) {
      onSelect(activity.id);
    }
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
