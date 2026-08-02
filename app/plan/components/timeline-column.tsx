import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { TripDay } from "@/lib/trips/days";
import {
  groupActivities,
  groupKey,
  type ActivityGroup,
} from "@/lib/activities/groups";
import { insertTransfers } from "@/lib/transfers/timeline";
import {
  ACTIVITY_TYPE_COLOR,
  ACTIVITY_TYPE_LABEL,
} from "@/lib/activities/type-meta";
import { formatTimeRange } from "@/lib/activities/format";
import { formatTransferMeta } from "@/lib/transfers/format";
import {
  HOUR_HEIGHT_PX,
  computeBlockLayout,
  computeTimelineGrid,
  formatGridHourLabel,
} from "@/lib/plan/timeline-grid";
import { DayTabs } from "./day-tabs";
import styles from "./timeline-column.module.css";

function resolveGroupActivity(
  group: ActivityGroup,
  optionSelections: Record<string, string>,
): Activity {
  const selectedId =
    optionSelections[groupKey(group)] ?? group.activities[0].id;
  return (
    group.activities.find((a) => a.id === selectedId) ?? group.activities[0]
  );
}

/**
 * Mittlere Spalte "Zeitstrahl" der Planungsansicht (siehe req-011): Tages-
 * Reiter, eine funktionslose Titelzeile und das Stundenraster mit den
 * Programmpunkt- und Transfer-Bloecken des gewaehlten Tages. Reine
 * Anzeige -- weder Bloecke noch die Titelzeilen-Schaltflaechen reagieren
 * auf Eingaben.
 */
export function TimelineColumn({
  days,
  selectedDate,
  onSelectDate,
  activities,
  transfers,
  optionSelections = {},
}: {
  days: TripDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Programmpunkte des gewaehlten Tages (siehe lib/activities/day.ts). */
  activities: Activity[];
  /** Alle Transfers der Reise; nur die zwischen benachbarten Eintraegen des Tages werden gezeigt. */
  transfers: Transfer[];
  optionSelections?: Record<string, string>;
}) {
  const grid = computeTimelineGrid(activities, selectedDate);
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );
  const activityById = new Map(activities.map((a) => [a.id, a]));

  const hours: number[] = [];
  for (let hour = grid.startHour; hour <= grid.endHour; hour += 1) {
    hours.push(hour);
  }
  const gridHeightPx = (grid.endHour - grid.startHour) * HOUR_HEIGHT_PX;

  return (
    <div className={styles.column}>
      <DayTabs
        days={days}
        selectedDate={selectedDate}
        onSelect={onSelectDate}
      />
      <div className={styles.titleRow}>
        <button type="button" className={styles.aiButton}>
          KI planen lassen
        </button>
        <button type="button" className={styles.transfersButton}>
          Transfers
        </button>
      </div>
      <div className={styles.scroll}>
        <div className={styles.grid} style={{ height: gridHeightPx }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className={styles.hourLine}
              style={{ top: (hour - grid.startHour) * HOUR_HEIGHT_PX }}
            >
              <span className={styles.hourLabel}>
                {formatGridHourLabel(hour)}
              </span>
            </div>
          ))}

          {entries.map((entry) => {
            if (entry.kind === "transfer") {
              const fromActivity = activityById.get(
                entry.transfer.fromActivityId,
              );
              if (!fromActivity) return null;
              const layout = computeBlockLayout(
                {
                  startAt: fromActivity.endAt,
                  endAt: entry.toActivity.startAt,
                },
                grid,
                selectedDate,
              );
              return (
                <div
                  key={entry.transfer.id}
                  className={styles.transferBlock}
                  data-testid={`transfer-block-${entry.transfer.id}`}
                  style={{
                    top: layout.topPx,
                    height: Math.max(layout.heightPx, 20),
                  }}
                >
                  {entry.transfer.title} · {formatTransferMeta(entry.transfer)}
                </div>
              );
            }

            const activity =
              entry.kind === "single"
                ? entry.activity
                : resolveGroupActivity(entry.group, optionSelections);
            const key =
              entry.kind === "single"
                ? entry.activity.id
                : groupKey(entry.group);
            const layout = computeBlockLayout(activity, grid, selectedDate);

            return (
              <div
                key={key}
                className={styles.activityBlock}
                data-testid={`activity-block-${activity.id}`}
                style={{
                  top: layout.topPx,
                  height: layout.heightPx,
                  borderColor: ACTIVITY_TYPE_COLOR[activity.type],
                }}
              >
                <p className={styles.activityTitle}>{activity.title}</p>
                <p className={styles.activityMeta}>
                  {formatTimeRange(activity)} ·{" "}
                  {ACTIVITY_TYPE_LABEL[activity.type]}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
