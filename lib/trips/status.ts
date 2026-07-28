import type { Trip } from "./types";
import { toIsoDate } from "./date-utils";

export type TripStatus = "aktiv" | "geplant" | "beendet";

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  aktiv: "Aktiv",
  geplant: "Geplant",
  beendet: "Beendet",
};

export function tripStatus(
  trip: Pick<Trip, "startDate" | "endDate">,
  today: Date,
): TripStatus {
  const todayIso = toIsoDate(today);
  if (todayIso < trip.startDate) return "geplant";
  if (todayIso > trip.endDate) return "beendet";
  return "aktiv";
}
