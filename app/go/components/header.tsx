import type { Trip } from "@/lib/trips/types";
import { formatDateRange } from "@/lib/trips/format";
import styles from "./header.module.css";

export function Header({
  trip,
  onOpenTripSheet,
}: {
  trip: Trip;
  onOpenTripSheet: () => void;
}) {
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.switcher}
        onClick={onOpenTripSheet}
      >
        <span className={styles.tile} aria-hidden="true">
          {trip.title.charAt(0)}
        </span>
        <span className={styles.titleGroup}>
          <span className={styles.title}>{trip.title}</span>
          <span className={styles.subtitle}>{formatDateRange(trip)}</span>
        </span>
        <svg
          className={styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </header>
  );
}
