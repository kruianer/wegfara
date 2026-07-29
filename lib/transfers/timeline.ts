import type { Activity } from "@/lib/activities/types";
import type { TimelineEntry } from "@/lib/activities/groups";
import type { Transfer } from "./types";

export type PlanEntry =
  | TimelineEntry
  | { kind: "transfer"; transfer: Transfer; toActivity: Activity };

function entryContains(entry: TimelineEntry, activityId: string): boolean {
  return entry.kind === "single"
    ? entry.activity.id === activityId
    : entry.group.activities.some((a) => a.id === activityId);
}

/**
 * Fuegt zwischen zwei aufeinanderfolgenden Zeitstrahl-Eintraegen den dazu
 * passenden Transfer ein, sofern einer existiert (siehe req-006). Ein
 * Transfer erscheint nur zwischen tatsaechlich benachbarten Eintraegen des
 * Tages; er zaehlt nicht als Programmpunkt und wird bei der Nummerierung
 * uebersprungen.
 */
export function insertTransfers(
  entries: TimelineEntry[],
  transfers: Transfer[],
  activities: Activity[],
): PlanEntry[] {
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const result: PlanEntry[] = [];

  entries.forEach((entry, index) => {
    result.push(entry);
    const next = entries[index + 1];
    if (!next) return;

    const transfer = transfers.find(
      (t) =>
        entryContains(entry, t.fromActivityId) &&
        entryContains(next, t.toActivityId),
    );
    if (!transfer) return;

    const toActivity = activityById.get(transfer.toActivityId);
    if (toActivity) {
      result.push({ kind: "transfer", transfer, toActivity });
    }
  });

  return result;
}
