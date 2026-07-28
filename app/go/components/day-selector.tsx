import type { TripDay } from "@/lib/trips/days";
import { formatDayChipDate } from "@/lib/trips/format";
import styles from "./day-selector.module.css";

export function DaySelector({
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
            className={`${styles.chip} ${selected ? styles.selected : ""}`}
            onClick={() => onSelect(day.date)}
          >
            <span className={styles.date}>{formatDayChipDate(day.date)}</span>
            <span className={styles.weekday}>{day.weekday}</span>
          </button>
        );
      })}
    </div>
  );
}
