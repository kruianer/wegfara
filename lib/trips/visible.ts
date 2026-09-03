import { tripIdOfGroupKey } from "../activities/groups";
import type { Trip } from "./types";

/**
 * Was zu einer Reise gehoert, die jemand nicht sieht, geht ihn auch nichts
 * an (req-023; siehe delivery/security.md, Zugriffskreis). Welche Reisen
 * jemand sieht, entscheidet lib/db/trips.ts -- hier wird nur alles Uebrige
 * darauf zugeschnitten, damit es gar nicht erst zum Browser geht.
 */
export function visibleTripIds(trips: Trip[]): Set<string> {
  return new Set(trips.map((trip) => trip.id));
}

/** Die Eintraege, die zu einer der sichtbaren Reisen gehoeren. */
export function forVisibleTrips<T extends { tripId: string }>(
  items: T[],
  visible: Set<string>,
): T[] {
  return items.filter((item) => visible.has(item.tripId));
}

/**
 * Die gewaehlten Alternativen der sichtbaren Reisen. Sie liegen als Map
 * ueber dem Gruppen-Schluessel vor, der mit der Reise-Id beginnt (siehe
 * lib/activities/groups.ts).
 */
export function selectionsForVisibleTrips(
  selections: Record<string, string>,
  visible: Set<string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(selections).filter(([key]) =>
      visible.has(tripIdOfGroupKey(key)),
    ),
  );
}
