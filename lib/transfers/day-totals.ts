import type { Activity } from "@/lib/activities/types";
import { groupActivities } from "@/lib/activities/groups";
import { insertTransfers } from "./timeline";
import type { Transfer } from "./types";

export interface DayTransferTotals {
  distanceKm: number;
  durationMin: number;
}

/** Summe aus Distanz und Dauer der Transfers eines Reisetages (siehe req-011, GUI). */
export function dayTransferTotals(
  activities: Activity[],
  transfers: Transfer[],
): DayTransferTotals {
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );

  return entries.reduce<DayTransferTotals>(
    (totals, entry) =>
      entry.kind === "transfer"
        ? {
            distanceKm: totals.distanceKm + entry.transfer.distanceKm,
            durationMin: totals.durationMin + entry.transfer.durationMin,
          }
        : totals,
    { distanceKm: 0, durationMin: 0 },
  );
}

/** z.B. "4,6 km · 22 Min Fahrzeit" aus den Tagestransfer-Summen. */
export function formatDayTransferTotals(totals: DayTransferTotals): string {
  const distance = totals.distanceKm.toFixed(1).replace(".", ",");
  return `${distance} km · ${totals.durationMin} Min Fahrzeit`;
}
