import type { Trip } from "./types";
import { parseIsoDate } from "./date-utils";

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** z.B. "18. – 23. Juli 2026" oder, ueber Monats-/Jahresgrenzen hinweg, "30. Juli – 2. August 2026". */
export function formatDateRange(
  trip: Pick<Trip, "startDate" | "endDate">,
): string {
  const start = parseIsoDate(trip.startDate);
  const end = parseIsoDate(trip.endDate);

  if (start.year !== end.year) {
    return `${start.day}. ${MONTHS_DE[start.month - 1]} ${start.year} – ${end.day}. ${MONTHS_DE[end.month - 1]} ${end.year}`;
  }
  if (start.month !== end.month) {
    return `${start.day}. ${MONTHS_DE[start.month - 1]} – ${end.day}. ${MONTHS_DE[end.month - 1]} ${end.year}`;
  }
  return `${start.day}. – ${end.day}. ${MONTHS_DE[end.month - 1]} ${end.year}`;
}

/** z.B. "20.07." — Datum ohne Jahr, wie in der Tagesauswahl gezeigt. */
export function formatDayChipDate(iso: string): string {
  const { month, day } = parseIsoDate(iso);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.`;
}
