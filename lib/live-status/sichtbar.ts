import type { Trip } from "@/lib/trips/types";

/**
 * Ob der Live-Status ueber dem Plan erscheint (req-051): nur solange das
 * heutige Datum im Zeitraum der Reise liegt und sie freigegeben ist. Sonst
 * ist er gar nicht vorhanden -- kein leerer Platzhalter.
 */
export function zeigtLiveStatus(
  trip: Pick<Trip, "startDate" | "endDate" | "state">,
  todayIso: string,
): boolean {
  return (
    trip.state === "freigegeben" &&
    todayIso >= trip.startDate &&
    todayIso <= trip.endDate
  );
}
