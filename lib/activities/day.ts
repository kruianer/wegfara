import type { Activity } from "./types";

/**
 * Programmpunkte eines Reisetags, aufsteigend nach Beginnzeit. Ein
 * Programmpunkt gehoert zu dem Tag, an dem er beginnt — auch wenn er ueber
 * Mitternacht hinausreicht.
 */
export function activitiesForDay(
  activities: Activity[],
  tripId: string,
  date: string,
): Activity[] {
  return activities
    .filter((a) => a.tripId === tripId && a.startAt.slice(0, 10) === date)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}
