import type { TripDay } from "@/lib/trips/days";
import { formatDayChipDate } from "@/lib/trips/format";
import styles from "./day-tabs.module.css";

/** Reiter fuer die Reisetage im Zeitstrahl (siehe req-011). */
export function DayTabs({
  days,
  selectedDate,
  onSelect,
}: {
  days: TripDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className={styles.row} role="tablist" aria-label="Reisetag wählen">
      {days.map((day) => {
        const selected = day.date === selectedDate;
        return (
          <button
            key={day.date}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.tab} ${selected ? styles.selected : ""}`}
            onClick={() => onSelect(day.date)}
          >
            <span className={styles.weekday}>{day.weekday}</span>
            <span className={styles.date}>{formatDayChipDate(day.date)}</span>
          </button>
        );
      })}
    </div>
  );
}
