import type { Activity } from "@/lib/activities/types";
import {
  groupActivities,
  groupKey,
  type ActivityGroup,
} from "@/lib/activities/groups";
import { ActivityCard } from "./activity-card";
import { ActivityOptionGroup } from "./activity-option-group";
import styles from "./timeline.module.css";

export function Timeline({
  activities,
  optionSelections = {},
  onSelectOption = () => {},
}: {
  activities: Activity[];
  /** Gespeicherte Wahl je Options-Gruppe, Schluessel via `groupKey`. */
  optionSelections?: Record<string, string>;
  onSelectOption?: (group: ActivityGroup, activityId: string) => void;
}) {
  if (activities.length === 0) {
    return <p className={styles.empty}>Noch nichts geplant</p>;
  }

  const entries = groupActivities(activities);

  return (
    <ol className={styles.list}>
      {entries.map((entry, index) => {
        const key =
          entry.kind === "single" ? entry.activity.id : groupKey(entry.group);
        return (
          <li key={key} className={styles.row}>
            <div className={styles.rail}>
              <span
                className={`${styles.circle} ${
                  entry.kind === "group" ? styles.circleGroup : ""
                }`}
              >
                {index + 1}
              </span>
            </div>
            {entry.kind === "single" ? (
              <ActivityCard activity={entry.activity} />
            ) : (
              <ActivityOptionGroup
                activities={entry.group.activities}
                selectedId={
                  optionSelections[groupKey(entry.group)] ??
                  entry.group.activities[0].id
                }
                onSelect={(activityId) =>
                  onSelectOption(entry.group, activityId)
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
