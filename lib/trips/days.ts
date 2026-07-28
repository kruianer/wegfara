import type { Trip } from "./types";
import { parseIsoDate } from "./date-utils";

export interface TripDay {
  /** ISO-Datum (YYYY-MM-DD). */
  date: string;
  /** Zweistelliges deutsches Wochentagskuerzel, z.B. "Mo". */
  weekday: string;
}

const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Alle Tage einer Reise, jeweils inklusive An- und Abreisetag. */
export function tripDays(trip: Pick<Trip, "startDate" | "endDate">): TripDay[] {
  const start = parseIsoDate(trip.startDate);
  const end = parseIsoDate(trip.endDate);

  const days: TripDay[] = [];
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  while (cursor.getTime() <= endUtc) {
    days.push({
      date: toIsoDate(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth() + 1,
        cursor.getUTCDate(),
      ),
      weekday: WEEKDAYS_DE[cursor.getUTCDay()],
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}
