import type { Activity } from "./types";

export interface ActivityGroup {
  tripId: string;
  startAt: string;
  endAt: string;
  activities: Activity[];
}

export type TimelineEntry =
  | { kind: "single"; activity: Activity }
  | { kind: "group"; group: ActivityGroup };

function memberKey(
  activity: Pick<Activity, "tripId" | "startAt" | "endAt">,
): string {
  return `${activity.tripId}|${activity.startAt}|${activity.endAt}`;
}

/** Stabiler Schluessel einer Options-Gruppe, z.B. zum Speichern der Wahl. */
export function groupKey(
  group: Pick<ActivityGroup, "tripId" | "startAt" | "endAt">,
): string {
  return memberKey(group);
}

/**
 * Fasst Programmpunkte derselben Reise mit exakt gleichem Beginn und Ende
 * zu einer Options-Gruppe zusammen (siehe Constraints in req-004);
 * einzelne Programmpunkte bleiben unveraendert. Die Reihenfolge der
 * Eintraege richtet sich nach der ersten Fundstelle der jeweiligen
 * Beginn-/Endzeit in `activities`.
 */
export function groupActivities(activities: Activity[]): TimelineEntry[] {
  const members = new Map<string, Activity[]>();
  for (const activity of activities) {
    const key = memberKey(activity);
    const list = members.get(key);
    if (list) list.push(activity);
    else members.set(key, [activity]);
  }

  const entries: TimelineEntry[] = [];
  const seen = new Set<string>();
  for (const activity of activities) {
    const key = memberKey(activity);
    if (seen.has(key)) continue;
    seen.add(key);

    const group = members.get(key)!;
    if (group.length > 1) {
      entries.push({
        kind: "group",
        group: {
          tripId: group[0].tripId,
          startAt: group[0].startAt,
          endAt: group[0].endAt,
          activities: group,
        },
      });
    } else {
      entries.push({ kind: "single", activity: group[0] });
    }
  }
  return entries;
}
