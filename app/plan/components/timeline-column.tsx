import type { DragEvent } from "react";
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
import { dropStartAt } from "@/lib/plan/plan-poi";
import { assignLanes, type Lane } from "@/lib/plan/overlap";
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

/** Die Stelle, an der ein Block liegt: von links `lane` von `lanes` Spuren. */
function laneStyle({ lane, lanes }: Lane) {
  return {
    left: `${(lane * 100) / lanes}%`,
    width: `calc(${100 / lanes}% - 4px)`,
  };
}

/**
 * Mittlere Spalte "Zeitstrahl" der Planungsansicht (siehe req-011): Tages-
 * Reiter, eine Titelzeile mit zwei noch funktionslosen Schaltflaechen und das
 * Stundenraster mit den Programmpunkt- und Transfer-Bloecken des gewaehlten
 * Tages.
 *
 * Seit req-039 nimmt das Raster einen aus "Noch unverplant" gezogenen POI
 * entgegen und jeder Programmpunkt laesst sich wieder entfernen. Ohne
 * `onDropPoi` und `onRemoveActivity` bleibt es bei der reinen Anzeige -- so
 * sieht ein Gast denselben Zeitstrahl, ohne ihn aendern zu koennen (req-038).
 */
export function TimelineColumn({
  days,
  selectedDate,
  onSelectDate,
  activities,
  transfers,
  optionSelections = {},
  onDropPoi,
  onRemoveActivity,
}: {
  days: TripDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Programmpunkte des gewaehlten Tages (siehe lib/activities/day.ts). */
  activities: Activity[];
  /** Alle Transfers der Reise; nur die zwischen benachbarten Eintraegen des Tages werden gezeigt. */
  transfers: Transfer[];
  optionSelections?: Record<string, string>;
  /** Ein POI wurde auf dem Raster losgelassen -- mit der Zeit, an der er dort beginnt. */
  onDropPoi?: (startAt: string) => void;
  onRemoveActivity?: (activity: Activity) => void;
}) {
  const grid = computeTimelineGrid(activities, selectedDate);
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );
  const activityById = new Map(activities.map((a) => [a.id, a]));

  // Ueberlappende Programmpunkte teilen sich die Breite (req-039). Eine
  // Options-Gruppe zaehlt dabei als ein Block -- ihre Alternativen liegen
  // ohnehin aufeinander (req-004).
  const blockEntries = entries.filter((entry) => entry.kind !== "transfer");
  const blockActivities = blockEntries.map((entry) =>
    entry.kind === "single"
      ? entry.activity
      : resolveGroupActivity(entry.group, optionSelections),
  );
  const lanes = new Map<string, Lane>();
  assignLanes(blockActivities).forEach((lane, index) => {
    const entry = blockEntries[index];
    lanes.set(
      entry.kind === "single" ? entry.activity.id : groupKey(entry.group),
      lane,
    );
  });

  const hours: number[] = [];
  for (let hour = grid.startHour; hour <= grid.endHour; hour += 1) {
    hours.push(hour);
  }
  const gridHeightPx = (grid.endHour - grid.startHour) * HOUR_HEIGHT_PX;

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Ohne dieses Abfangen nimmt der Browser den Zug gar nicht erst an.
    if (onDropPoi) event.preventDefault();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onDropPoi) return;
    event.preventDefault();
    // Die Stelle im Raster, gemessen an dessen Oberkante -- so zaehlt der
    // Stand der Bildlaufleiste bereits mit.
    const top = event.currentTarget.getBoundingClientRect().top;
    onDropPoi(dropStartAt(selectedDate, event.clientY - top, grid));
  }

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
        <div
          className={styles.grid}
          style={{ height: gridHeightPx }}
          data-testid="timeline-grid"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
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

          <div className={styles.blocks}>
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
                    {entry.transfer.title} ·{" "}
                    {formatTransferMeta(entry.transfer)}
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
              const lane = lanes.get(key) ?? { lane: 0, lanes: 1 };

              return (
                <div
                  key={key}
                  className={styles.activityBlock}
                  data-testid={`activity-block-${activity.id}`}
                  style={{
                    top: layout.topPx,
                    height: layout.heightPx,
                    borderColor: ACTIVITY_TYPE_COLOR[activity.type],
                    ...laneStyle(lane),
                  }}
                >
                  <p className={styles.activityTitle}>{activity.title}</p>
                  <p className={styles.activityMeta}>
                    {formatTimeRange(activity)} ·{" "}
                    {ACTIVITY_TYPE_LABEL[activity.type]}
                  </p>
                  {onRemoveActivity && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      data-testid={`remove-activity-${activity.id}`}
                      aria-label={`Programmpunkt „${activity.title}“ entfernen`}
                      onClick={() => onRemoveActivity(activity)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
