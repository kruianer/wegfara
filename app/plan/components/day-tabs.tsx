import type { TripDay } from "@/lib/trips/days";
import { formatDayChipDate } from "@/lib/trips/format";
import styles from "./day-tabs.module.css";

/**
 * Reiter fuer die Reisetage im Zeitstrahl (siehe req-011).
 *
 * Seit req-040 nimmt ein Reiter einen darauf gezogenen Programmpunkt
 * entgegen. Ohne `onDropDay` bleibt es beim reinen Umschalten.
 */
export function DayTabs({
  days,
  selectedDate,
  onSelect,
  onDropDay,
}: {
  days: TripDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
  /** Ein Programmpunkt wurde auf dem Reiter dieses Reisetages losgelassen. */
  onDropDay?: (date: string) => void;
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
            data-testid={`day-tab-${day.date}`}
            onClick={() => onSelect(day.date)}
            onDragOver={(event) => {
              // Ohne dieses Abfangen nimmt der Browser den Zug gar nicht erst an.
              if (onDropDay) event.preventDefault();
            }}
            onDrop={(event) => {
              if (!onDropDay) return;
              event.preventDefault();
              onDropDay(day.date);
            }}
          >
            <span className={styles.weekday}>{day.weekday}</span>
            <span className={styles.date}>{formatDayChipDate(day.date)}</span>
          </button>
        );
      })}
    </div>
  );
}
