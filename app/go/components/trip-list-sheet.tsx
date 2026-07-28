import type { Trip } from "@/lib/trips/types";
import { tripStatus, TRIP_STATUS_LABEL } from "@/lib/trips/status";
import { formatDateRange } from "@/lib/trips/format";
import styles from "./trip-list-sheet.module.css";

export function TripListSheet({
  trips,
  today,
  selectedTripId,
  onSelect,
  onClose,
}: {
  trips: Trip[];
  today: Date;
  selectedTripId: string;
  onSelect: (tripId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-label="Reise wählen"
        onClick={(e) => e.stopPropagation()}
      >
        <ul className={styles.list}>
          {trips.map((trip) => {
            const status = tripStatus(trip, today);
            return (
              <li key={trip.id}>
                <button
                  type="button"
                  className={styles.item}
                  aria-current={trip.id === selectedTripId}
                  onClick={() => onSelect(trip.id)}
                >
                  <span className={styles.tile} aria-hidden="true">
                    {trip.title.charAt(0)}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.name}>{trip.title}</span>
                    <span className={styles.dates}>
                      {formatDateRange(trip)}
                    </span>
                  </span>
                  <span className={`${styles.statusPill} ${styles[status]}`}>
                    {TRIP_STATUS_LABEL[status]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
