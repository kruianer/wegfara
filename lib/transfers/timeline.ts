import type { Activity } from "@/lib/activities/types";
import type { TimelineEntry } from "@/lib/activities/groups";
import type { Transfer } from "./types";

export type PlanEntry =
  | TimelineEntry
  | { kind: "transfer"; transfer: Transfer; toActivity: Activity };

/**
 * Ob ein Zeitstrahl-Eintrag diesen Programmpunkt enthaelt -- bei einer
 * Options-Gruppe zaehlt jede ihrer Alternativen (req-004). Der Zeitstrahl
 * findet damit den Transfer zu einer Luecke (req-052).
 */
export function entryContains(
  entry: TimelineEntry,
  activityId: string,
): boolean {
  return entry.kind === "single"
    ? entry.activity.id === activityId
    : entry.group.activities.some((a) => a.id === activityId);
}

/**
 * Der Transfer zwischen zwei Zeitstrahl-Eintraegen -- zwischen denselben
 * beiden gibt es hoechstens einen (req-052).
 */
export function transferBetween(
  transfers: Transfer[],
  from: TimelineEntry,
  to: TimelineEntry,
): Transfer | undefined {
  return transfers.find(
    (transfer) =>
      entryContains(from, transfer.fromActivityId) &&
      entryContains(to, transfer.toActivityId),
  );
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

    const transfer = transferBetween(transfers, entry, next);
    if (!transfer) return;

    const toActivity = activityById.get(transfer.toActivityId);
    if (toActivity) {
      result.push({ kind: "transfer", transfer, toActivity });
    }
  });

  return result;
}
