import type { Activity, ActivityPosition } from "@/lib/activities/types";
import { groupActivities, groupKey } from "@/lib/activities/groups";
import type { Transfer, TransferMode } from "@/lib/transfers/types";
import { insertTransfers } from "@/lib/transfers/timeline";

export interface DayMapMarker {
  /** Reihenfolge im Zeitstrahl, identisch zu dessen Nummerierung. */
  number: number;
  activity: Activity;
  position: ActivityPosition;
  /** Gehoert der Marker zu einer Options-Gruppe (siehe req-004)? */
  isGroup: boolean;
}

export interface DayMapLine {
  mode: TransferMode;
  from: ActivityPosition;
  to: ActivityPosition;
}

export interface DayMapData {
  markers: DayMapMarker[];
  lines: DayMapLine[];
}

/**
 * Leitet aus den Programmpunkten und Transfers eines Reisetages die
 * Kartendarstellung ab (siehe req-008): ein Marker je Zeitstrahl-Eintrag
 * (Options-Gruppen nur mit der gewaehlten Alternative), eine Linie je
 * hinterlegtem Transfer. Programmpunkte ohne Position erscheinen nicht als
 * Marker; Transfers ohne Position an Start oder Ziel erzeugen keine Linie.
 */
export function buildDayMap(
  activities: Activity[],
  transfers: Transfer[],
  optionSelections: Record<string, string> = {},
): DayMapData {
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );

  const markers: DayMapMarker[] = [];
  let counter = 0;
  for (const entry of entries) {
    if (entry.kind === "transfer") continue;
    counter += 1;

    const activity =
      entry.kind === "single"
        ? entry.activity
        : (entry.group.activities.find(
            (a) =>
              a.id ===
              (optionSelections[groupKey(entry.group)] ??
                entry.group.activities[0].id),
          ) ?? entry.group.activities[0]);

    if (!activity.position) continue;
    markers.push({
      number: counter,
      activity,
      position: activity.position,
      isGroup: entry.kind === "group",
    });
  }

  const lines: DayMapLine[] = [];
  for (const entry of entries) {
    if (entry.kind !== "transfer") continue;
    const from = activityById.get(entry.transfer.fromActivityId);
    const to = entry.toActivity;
    if (from?.position && to.position) {
      lines.push({
        mode: entry.transfer.mode,
        from: from.position,
        to: to.position,
      });
    }
  }

  return { markers, lines };
}
