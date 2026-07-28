"use client";

import { useState } from "react";
import type { Activity } from "@/lib/activities/types";
import {
  ACTIVITY_TYPE_COLOR,
  ACTIVITY_TYPE_LABEL,
} from "@/lib/activities/type-meta";
import { formatTimeRange } from "@/lib/activities/format";
import { resolveBookingAction } from "@/lib/activities/booking";
import { BookingButton } from "./booking-button";
import styles from "./activity-card.module.css";

export function ActivityCard({
  activity,
  selected,
}: {
  activity: Activity;
  /** Kennzeichnet die Karte als gewaehlte Alternative einer Options-Gruppe. */
  selected?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = ACTIVITY_TYPE_COLOR[activity.type];
  const bookingAction = resolveBookingAction(activity);

  return (
    <div className={`${styles.card} ${selected ? styles.selected : ""}`}>
      <div className={styles.photo} style={{ backgroundColor: color }}>
        <span className={styles.typeChip} style={{ backgroundColor: color }}>
          {ACTIVITY_TYPE_LABEL[activity.type]}
        </span>
        <span className={styles.timePill}>{formatTimeRange(activity)}</span>
        {selected && <span className={styles.selectedPill}>✓ Gewählt</span>}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{activity.title}</h3>
        <p className={styles.shortText}>{activity.shortText}</p>
        {expanded && <p className={styles.longText}>{activity.longText}</p>}
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Weniger anzeigen" : "Mehr lesen"}
        </button>
        {bookingAction && (
          <div className={styles.actions}>
            <BookingButton action={bookingAction} />
          </div>
        )}
      </div>
    </div>
  );
}
