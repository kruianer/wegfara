import type { Trip } from "./types";
import { tripStatus } from "./status";
import { toIsoDate } from "./date-utils";

/**
 * Welche Reise beim Oeffnen des Begleiters vorausgewaehlt ist: die gerade
 * aktive; ohne aktive Reise die naechste geplante; ohne geplante die
 * zuletzt beendete. Gray-Area-Entscheidung (siehe delivery/vision.md,
 * "im Zweifel: wenige Schritte statt viele Optionen").
 */
export function defaultTripId(trips: Trip[], today: Date): string | null {
  if (trips.length === 0) return null;

  const active = trips.find((t) => tripStatus(t, today) === "aktiv");
  if (active) return active.id;

  const upcoming = trips
    .filter((t) => tripStatus(t, today) === "geplant")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) return upcoming.id;

  const past = trips
    .filter((t) => tripStatus(t, today) === "beendet")
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  return (past ?? trips[0]).id;
}

/** Welcher Reisetag vorausgewaehlt ist: heute, falls innerhalb des Zeitraums, sonst der Anreisetag. */
export function defaultDay(
  trip: Pick<Trip, "startDate" | "endDate">,
  today: Date,
): string {
  const todayIso = toIsoDate(today);
  if (todayIso >= trip.startDate && todayIso <= trip.endDate) return todayIso;
  return trip.startDate;
}
