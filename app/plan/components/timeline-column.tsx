import { useState, type DragEvent } from "react";
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
import { dropEndAt, sameTimeOnDay } from "@/lib/plan/move-activity";
import { assignLanes, type Lane } from "@/lib/plan/overlap";
import { DayTabs } from "./day-tabs";
import styles from "./timeline-column.module.css";

/**
 * Was gerade am Zeitstrahl gezogen wird (req-040): der ganze Programmpunkt
 * ("move") oder nur sein unterer Rand ("resize"). Ein aus "Noch unverplant"
 * gezogener POI steht hier nicht -- der liegt im Zustand der Planungsansicht,
 * weil er aus der Schwesterspalte kommt (req-039).
 */
type DraggedActivity = { activity: Activity; mode: "move" | "resize" };

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
 * entgegen und jeder Programmpunkt laesst sich wieder entfernen; seit req-040
 * laesst er sich auch auf eine andere Uhrzeit, auf den Reiter eines anderen
 * Reisetages und an seinem unteren Rand laenger oder kuerzer ziehen. Ohne die
 * jeweiligen Rueckrufe bleibt es bei der reinen Anzeige -- so sieht ein Gast
 * denselben Zeitstrahl, ohne ihn aendern zu koennen (req-038).
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
  onMoveActivity,
  onResizeActivity,
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
  /** Ein Programmpunkt wurde an eine neue Startzeit gezogen (req-040). */
  onMoveActivity?: (activity: Activity, startAt: string) => void;
  /** Der untere Rand eines Programmpunkts wurde auf ein neues Ende gezogen (req-040). */
  onResizeActivity?: (activity: Activity, endAt: string) => void;
}) {
  // Wer gerade gezogen wird. Der Zustand steht hier und nicht im Datentransfer
  // des Zuges: Block, Raster und Tages-Reiter gehoeren zu derselben Spalte,
  // und der Datentransfer ist erst beim Loslassen lesbar.
  const [dragged, setDragged] = useState<DraggedActivity | null>(null);
  const umplanbar = Boolean(onMoveActivity && onResizeActivity);
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
    if (onDropPoi || umplanbar) event.preventDefault();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onDropPoi && !umplanbar) return;
    event.preventDefault();
    // Die Stelle im Raster, gemessen an dessen Oberkante -- so zaehlt der
    // Stand der Bildlaufleiste bereits mit.
    const top = event.currentTarget.getBoundingClientRect().top;
    const offset = event.clientY - top;
    setDragged(null);

    // Ein gezogener Programmpunkt geht vor: nur wenn keiner gezogen wird,
    // kommt ein POI aus "Noch unverplant" an (req-039).
    if (dragged?.mode === "resize" && onResizeActivity) {
      onResizeActivity(dragged.activity, dropEndAt(selectedDate, offset, grid));
    } else if (dragged?.mode === "move" && onMoveActivity) {
      onMoveActivity(dragged.activity, dropStartAt(selectedDate, offset, grid));
    } else if (!dragged && onDropPoi) {
      onDropPoi(dropStartAt(selectedDate, offset, grid));
    }
  }

  /**
   * Auf einem Tages-Reiter losgelassen (req-040): der Programmpunkt wechselt
   * dorthin und behaelt Uhrzeit und Dauer. Der untere Rand hat auf einem
   * Reiter nichts zu suchen -- eine Dauer ergibt sich aus dem Raster.
   */
  function handleDropDay(date: string) {
    const gezogen = dragged;
    setDragged(null);
    if (gezogen?.mode !== "move" || !onMoveActivity) return;
    onMoveActivity(gezogen.activity, sameTimeOnDay(gezogen.activity, date));
  }

  return (
    <div className={styles.column}>
      <DayTabs
        days={days}
        selectedDate={selectedDate}
        onSelect={onSelectDate}
        onDropDay={umplanbar ? handleDropDay : undefined}
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
                  className={`${styles.activityBlock}${onMoveActivity ? ` ${styles.movable}` : ""}`}
                  data-testid={`activity-block-${activity.id}`}
                  style={{
                    top: layout.topPx,
                    height: layout.heightPx,
                    borderColor: ACTIVITY_TYPE_COLOR[activity.type],
                    ...laneStyle(lane),
                  }}
                  draggable={Boolean(onMoveActivity)}
                  onDragStart={(event) => {
                    if (!onMoveActivity) return;
                    // Manche Browser starten einen Zug nur mit gesetzten Daten.
                    event.dataTransfer?.setData("text/plain", activity.id);
                    setDragged({ activity, mode: "move" });
                  }}
                  onDragEnd={() => setDragged(null)}
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
                  {onResizeActivity && (
                    <div
                      className={styles.resizeHandle}
                      data-testid={`resize-activity-${activity.id}`}
                      title={`Dauer von „${activity.title}“ ziehen`}
                      draggable
                      onDragStart={(event) => {
                        // Sonst zoege der Block darunter gleich mit.
                        event.stopPropagation();
                        event.dataTransfer?.setData("text/plain", activity.id);
                        setDragged({ activity, mode: "resize" });
                      }}
                      onDragEnd={() => setDragged(null)}
                    />
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
