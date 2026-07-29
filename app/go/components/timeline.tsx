import type { Activity } from "@/lib/activities/types";
import {
  groupActivities,
  groupKey,
  type ActivityGroup,
} from "@/lib/activities/groups";
import type { Transfer } from "@/lib/transfers/types";
import { insertTransfers } from "@/lib/transfers/timeline";
import { ActivityCard } from "./activity-card";
import { ActivityOptionGroup } from "./activity-option-group";
import { TransferRow } from "./transfer-row";
import styles from "./timeline.module.css";

export function Timeline({
  activities,
  transfers = [],
  optionSelections = {},
  onSelectOption = () => {},
}: {
  activities: Activity[];
  transfers?: Transfer[];
  /** Gespeicherte Wahl je Options-Gruppe, Schluessel via `groupKey`. */
  optionSelections?: Record<string, string>;
  onSelectOption?: (group: ActivityGroup, activityId: string) => void;
}) {
  if (activities.length === 0) {
    return <p className={styles.empty}>Noch nichts geplant</p>;
  }

  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );

  const numbers: (number | null)[] = [];
  let counter = 0;
  for (const entry of entries) {
    if (entry.kind === "transfer") {
      numbers.push(null);
    } else {
      counter += 1;
      numbers.push(counter);
    }
  }

  return (
    <ol className={styles.list}>
      {entries.map((entry, index) => {
        if (entry.kind === "transfer") {
          return (
            <li
              key={entry.transfer.id}
              className={`${styles.row} ${styles.transferRow}`}
            >
              <div className={`${styles.rail} ${styles.railTransfer}`}>
                <span className={styles.transferDot} />
              </div>
              <TransferRow
                transfer={entry.transfer}
                toActivity={entry.toActivity}
              />
            </li>
          );
        }

        const number = numbers[index];
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
                {number}
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
