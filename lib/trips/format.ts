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

/** Was beim Loeschen einer Reise verloren geht (siehe req-017). */
export interface TripContents {
  pois: number;
  activities: number;
  transfers: number;
}

function count(anzahl: number, einzahl: string, mehrzahl: string): string {
  return `${anzahl} ${anzahl === 1 ? einzahl : mehrzahl}`;
}

/**
 * Benennt, was beim Loeschen einer Reise verloren geht, z.B.
 * "12 POIs, 9 Programmpunkte und 3 Transfers" (siehe req-017). Auch Nullen
 * werden genannt -- die Rueckfrage soll den vollen Umfang zeigen, statt
 * einen Teil davon zu verschweigen.
 */
export function formatTripContents(contents: TripContents): string {
  return (
    `${count(contents.pois, "POI", "POIs")}, ` +
    `${count(contents.activities, "Programmpunkt", "Programmpunkte")} und ` +
    `${count(contents.transfers, "Transfer", "Transfers")}`
  );
}

/** z.B. "20.07." — Datum ohne Jahr, wie in der Tagesauswahl gezeigt. */
export function formatDayChipDate(iso: string): string {
  const { month, day } = parseIsoDate(iso);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.`;
}
