import type { Activity } from "@/lib/activities/types";
import { ActivityCard } from "./activity-card";
import styles from "./timeline.module.css";

export function Timeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className={styles.empty}>Noch nichts geplant</p>;
  }

  return (
    <ol className={styles.list}>
      {activities.map((activity, index) => (
        <li key={activity.id} className={styles.row}>
          <div className={styles.rail}>
            <span className={styles.circle}>{index + 1}</span>
          </div>
          <ActivityCard activity={activity} />
        </li>
      ))}
    </ol>
  );
}
