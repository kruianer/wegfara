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
  formatGridHourLabel,
  type TimelineGrid,
} from "@/lib/plan/timeline-grid";
import { dropStartAt } from "@/lib/plan/plan-poi";
import { dropEndAt, sameTimeOnDay } from "@/lib/plan/move-activity";
import { timelineDragPreview } from "@/lib/plan/drag-preview";
import { assignLanes, type Lane } from "@/lib/plan/overlap";
import {
  dropGridProps,
  usePointerDrag,
  type DropTarget,
  type PointerDragHandlers,
} from "./pointer-drag";
import { DayTabs } from "./day-tabs";
import styles from "./timeline-column.module.css";

/**
 * Was gerade am Zeitstrahl gezogen wird (req-040): der ganze Programmpunkt
 * ("move"), seine obere Kante ("resize-start", req-046) oder seine untere
 * ("resize-end"). Ein aus "Noch unverplant" gezogener POI steht hier nicht --
 * der liegt im Zustand der Planungsansicht, weil er aus der Schwesterspalte
 * kommt (req-039).
 */
type DragMode = "move" | "resize-start" | "resize-end";
type DraggedActivity = { activity: Activity; mode: DragMode };

/**
 * Ein aus "Noch unverplant" gezogener POI, wie ihn die Planungsansicht meldet
 * (req-046). `offsetPx` traegt nur der Zug mit dem Finger: dessen
 * Zeiger-Ereignisse kommen bei der Schwesterspalte an, nicht hier -- beim
 * nativen Zug der Maus meldet das Raster die Stelle selbst.
 */
export interface PoiDragPreview {
  durationMinutes: number;
  offsetPx: number | null;
}

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
 * Reisetages und an seinem unteren Rand laenger oder kuerzer ziehen -- seit
 * bug-017 mit der Maus wie mit dem Finger. Seit req-046 laesst sich ebenso
 * seine obere Kante ziehen, und waehrend jedes Zuges ueber dem Raster liegt
 * dort ein Umriss mit der Uhrzeit, an der eingerastet wird. Ohne die
 * jeweiligen Rueckrufe bleibt es bei der reinen Anzeige.
 */
export function TimelineColumn({
  days,
  selectedDate,
  onSelectDate,
  activities,
  transfers,
  grid,
  optionSelections = {},
  poiPreview = null,
  onDropPoi,
  onRemoveActivity,
  onMoveActivity,
  onResizeActivity,
  onResizeActivityStart,
}: {
  days: TripDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Programmpunkte des gewaehlten Tages (siehe lib/activities/day.ts). */
  activities: Activity[];
  /** Alle Transfers der Reise; nur die zwischen benachbarten Eintraegen des Tages werden gezeigt. */
  transfers: Transfer[];
  /** Der Stundenbereich des Tages -- er entscheidet, welche Uhrzeit eine Stelle im Raster meint. */
  grid: TimelineGrid;
  optionSelections?: Record<string, string>;
  /** Ein POI aus der Schwesterspalte, solange er gezogen wird (req-046). */
  poiPreview?: PoiDragPreview | null;
  /** Ein POI wurde auf dem Raster losgelassen -- mit der Zeit, an der er dort beginnt. */
  onDropPoi?: (startAt: string) => void;
  onRemoveActivity?: (activity: Activity) => void;
  /** Ein Programmpunkt wurde an eine neue Startzeit gezogen (req-040). */
  onMoveActivity?: (activity: Activity, startAt: string) => void;
  /** Der untere Rand eines Programmpunkts wurde auf ein neues Ende gezogen (req-040). */
  onResizeActivity?: (activity: Activity, endAt: string) => void;
  /** Die obere Kante wurde auf einen neuen Beginn gezogen; das Ende bleibt (req-046). */
  onResizeActivityStart?: (activity: Activity, startAt: string) => void;
}) {
  // Wer gerade gezogen wird. Der Zustand steht hier und nicht im Datentransfer
  // des Zuges: Block, Raster und Tages-Reiter gehoeren zu derselben Spalte,
  // und der Datentransfer ist erst beim Loslassen lesbar.
  const [dragged, setDragged] = useState<DraggedActivity | null>(null);
  // Wo der Zeiger gerade ueber dem Raster steht -- daraus entsteht der Umriss
  // (req-046). Null heisst: es wird nicht (mehr) ueber dem Raster gezogen.
  const [dragOffsetPx, setDragOffsetPx] = useState<number | null>(null);
  const umplanbar = Boolean(onMoveActivity && onResizeActivity);
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

  /**
   * Ein gezogener Programmpunkt wurde abgelegt -- ueber Maus oder Finger
   * derselbe Weg (bug-017). Auf dem Raster zaehlt die Stelle: der ganze
   * Programmpunkt beginnt dort, seine untere Kante endet dort (req-040), seine
   * obere beginnt dort und laesst das Ende stehen (req-046). Auf einem
   * Tages-Reiter wechselt er den Tag und behaelt Uhrzeit und Dauer -- eine
   * Kante hat dort nichts zu suchen, eine Dauer ergibt sich aus dem Raster.
   */
  function ablegen(gezogen: DraggedActivity, ziel: DropTarget) {
    if (ziel.kind === "day") {
      if (gezogen.mode !== "move" || !onMoveActivity) return;
      onMoveActivity(
        gezogen.activity,
        sameTimeOnDay(gezogen.activity, ziel.date),
      );
      return;
    }

    if (gezogen.mode === "resize-end" && onResizeActivity) {
      onResizeActivity(
        gezogen.activity,
        dropEndAt(selectedDate, ziel.offsetPx, grid),
      );
    } else if (gezogen.mode === "resize-start" && onResizeActivityStart) {
      onResizeActivityStart(
        gezogen.activity,
        dropStartAt(selectedDate, ziel.offsetPx, grid),
      );
    } else if (gezogen.mode === "move" && onMoveActivity) {
      onMoveActivity(
        gezogen.activity,
        dropStartAt(selectedDate, ziel.offsetPx, grid),
      );
    }
  }

  /** Der Umriss verschwindet -- der Zug ist vorbei (req-046). */
  function vorschauEnde() {
    setDragged(null);
    setDragOffsetPx(null);
  }

  // Ziehen mit dem Finger (bug-017): der native Zug bleibt der Maus.
  const fingerZug = usePointerDrag<DraggedActivity>({
    enabled: umplanbar,
    // Beim Finger gibt es kein `dragstart`: was gezogen wird, steht erst mit
    // der ersten Bewegung fest (req-046).
    onDragMove: (gezogen, ziel) => {
      setDragged(gezogen);
      setDragOffsetPx(ziel?.kind === "grid" ? ziel.offsetPx : null);
    },
    onDrop: ablegen,
    onDragEnd: vorschauEnde,
  });

  /**
   * Derselbe Zug an einer Kante -- er bleibt dort haengen, sonst zoege der
   * Block darunter gleich mit (wie beim nativen Zug).
   */
  function kantenZug(activity: Activity, mode: DragMode): PointerDragHandlers {
    const handlers = fingerZug({ activity, mode });
    return {
      ...handlers,
      onPointerDown: (event) => {
        event.stopPropagation();
        handlers.onPointerDown(event);
      },
    };
  }

  /** Was der native Zug einer Kante braucht (req-040, req-046). */
  function kantenZugProps(activity: Activity, mode: DragMode) {
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLDivElement>) => {
        // Sonst zoege der Block darunter gleich mit.
        event.stopPropagation();
        event.dataTransfer?.setData("text/plain", activity.id);
        setDragged({ activity, mode });
      },
      onDragEnd: vorschauEnde,
      ...kantenZug(activity, mode),
    };
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!onDropPoi && !umplanbar) return;
    // Ohne dieses Abfangen nimmt der Browser den Zug gar nicht erst an.
    event.preventDefault();
    // Solange der Zeiger ueber dem Raster steht, folgt ihm der Umriss (req-046).
    setDragOffsetPx(offsetImRaster(event));
  }

  /** Der Zeiger hat das Raster verlassen -- dann rastet dort nichts ein. */
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Zwischen Raster und den Bloecken darin wechselt der Zeiger waehrend des
    // Zuges staendig; nur ein Verlassen des Rasters selbst zaehlt, sonst
    // flackerte der Umriss ueber jedem Programmpunkt.
    const nach = event.relatedTarget;
    if (nach instanceof Node && event.currentTarget.contains(nach)) return;
    setDragOffsetPx(null);
  }

  /**
   * Die Stelle im Raster, gemessen an dessen Oberkante -- so zaehlt der Stand
   * der Bildlaufleiste bereits mit.
   */
  function offsetImRaster(event: DragEvent<HTMLDivElement>): number {
    return event.clientY - event.currentTarget.getBoundingClientRect().top;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onDropPoi && !umplanbar) return;
    event.preventDefault();
    const ziel: DropTarget = { kind: "grid", offsetPx: offsetImRaster(event) };
    const gezogen = dragged;
    vorschauEnde();

    // Ein gezogener Programmpunkt geht vor: nur wenn keiner gezogen wird,
    // kommt ein POI aus "Noch unverplant" an (req-039).
    if (gezogen) ablegen(gezogen, ziel);
    else if (onDropPoi)
      onDropPoi(dropStartAt(selectedDate, ziel.offsetPx, grid));
  }

  /** Auf einem Tages-Reiter losgelassen (req-040). */
  function handleDropDay(date: string) {
    const gezogen = dragged;
    vorschauEnde();
    if (gezogen) ablegen(gezogen, { kind: "day", date });
  }

  /**
   * Der Umriss, der zeigt, wo eingerastet wird (req-046) -- fuer den gezogenen
   * Programmpunkt ebenso wie fuer einen POI aus der Schwesterspalte. Beim Zug
   * mit dem Finger meldet die Planungsansicht dessen Stelle, beim nativen Zug
   * der Maus das Raster selbst.
   */
  const vorschauOffsetPx = poiPreview?.offsetPx ?? dragOffsetPx;
  const vorschau =
    vorschauOffsetPx === null
      ? null
      : dragged
        ? timelineDragPreview(
            { kind: dragged.mode, activity: dragged.activity },
            selectedDate,
            vorschauOffsetPx,
            grid,
          )
        : poiPreview
          ? timelineDragPreview(
              { kind: "poi", durationMinutes: poiPreview.durationMinutes },
              selectedDate,
              vorschauOffsetPx,
              grid,
            )
          : null;

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
          {...dropGridProps}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
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
                  onDragEnd={vorschauEnde}
                  {...fingerZug({ activity, mode: "move" })}
                >
                  <p className={styles.activityTitle}>{activity.title}</p>
                  <p className={styles.activityMeta}>
                    {formatTimeRange(activity)} ·{" "}
                    {ACTIVITY_TYPE_LABEL[activity.type]}
                  </p>
                  {onResizeActivityStart && (
                    <div
                      className={`${styles.resizeHandle} ${styles.resizeHandleTop}`}
                      data-testid={`resize-activity-start-${activity.id}`}
                      title={`Beginn von „${activity.title}“ ziehen`}
                      {...kantenZugProps(activity, "resize-start")}
                    />
                  )}
                  {onResizeActivity && (
                    <div
                      className={`${styles.resizeHandle} ${styles.resizeHandleBottom}`}
                      data-testid={`resize-activity-${activity.id}`}
                      title={`Ende von „${activity.title}“ ziehen`}
                      {...kantenZugProps(activity, "resize-end")}
                    />
                  )}
                  {/* Nach den Kanten und damit ueber ihnen: die obere Kante
                      liegt sonst auf dem Kreuz, und es liesse sich nicht mehr
                      treffen (req-039). */}
                  {onRemoveActivity && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      data-testid={`remove-activity-${activity.id}`}
                      aria-label={`Programmpunkt „${activity.title}“ entfernen`}
                      // Sonst begaenne ein Fingertipp auf das Kreuz einen Zug.
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onRemoveActivity(activity)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {/* Zuletzt und damit ueber den Bloecken: der Umriss soll auch
                sichtbar bleiben, wenn dort schon ein Programmpunkt liegt
                (Ueberlappungen sind erlaubt, req-039). */}
            {vorschau && (
              <div
                className={styles.previewBlock}
                data-testid="drag-preview"
                aria-hidden="true"
                style={{ top: vorschau.topPx, height: vorschau.heightPx }}
              >
                <span className={styles.previewTime}>{vorschau.label}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
