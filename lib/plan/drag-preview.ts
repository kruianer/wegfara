import type { Activity } from "@/lib/activities/types";
import {
  dayTimeAt,
  dropStartAt,
  minutesAtOffset,
  snapStartMinutes,
} from "./plan-poi";
import {
  dropEndAt,
  durationMinutes,
  resizedActivityStartTimes,
  resizedActivityTimes,
  type ActivityTimes,
} from "./move-activity";
import { computeBlockLayout, type TimelineGrid } from "./timeline-grid";

/**
 * Die Vorschau beim Ziehen (req-046): waehrend der Zeiger ueber dem Raster
 * steht, zeigt der Zeitstrahl einen Umriss dort, wo der Programmpunkt
 * einrasten wird -- in seiner Hoehe und beschriftet mit der Uhrzeit.
 *
 * Gerechnet wird mit denselben Regeln, nach denen beim Loslassen gespeichert
 * wird (req-039, req-040): der Umriss zeigt nie etwas anderes als das
 * Ergebnis. Deshalb steht das hier und nicht in der Oberflaeche.
 */

/** Was gerade gezogen wird -- daraus ergibt sich, welche Kante der Zeiger fuehrt. */
export type TimelineDrag =
  /** Ein POI aus "Noch unverplant"; seine geschaetzte Dauer bestimmt die Hoehe (req-039). */
  | { kind: "poi"; durationMinutes: number }
  /** Ein liegender Programmpunkt als Ganzes; die Dauer bleibt (req-040). */
  | { kind: "move"; activity: Pick<Activity, "startAt" | "endAt"> }
  /** Seine obere Kante; das Ende bleibt stehen (req-046). */
  | { kind: "resize-start"; activity: Pick<Activity, "startAt" | "endAt"> }
  /** Seine untere Kante; der Beginn bleibt stehen (req-040). */
  | { kind: "resize-end"; activity: Pick<Activity, "startAt" | "endAt"> };

/** Der Umriss, den der Zeitstrahl waehrend des Ziehens zeigt. */
export interface DragPreview {
  topPx: number;
  heightPx: number;
  /** Die Uhrzeit der gezogenen Kante, z.B. "14:00". */
  label: string;
}

/** Wo ein an dieser Stelle des Rasters losgelassener Zug einrasten wird. */
export function timelineDragTimes(
  drag: TimelineDrag,
  date: string,
  offsetPx: number,
  grid: TimelineGrid,
): ActivityTimes | null {
  if (drag.kind === "resize-end") {
    return resizedActivityTimes(drag.activity, dropEndAt(date, offsetPx, grid));
  }
  if (drag.kind === "resize-start") {
    return resizedActivityStartTimes(
      drag.activity,
      dropStartAt(date, offsetPx, grid),
    );
  }

  // POI wie ganzer Programmpunkt rasten mit ihrem Beginn ein und behalten
  // ihre Dauer -- beim POI ist es die geschaetzte seines Typs (req-011).
  const dauer =
    drag.kind === "poi" ? drag.durationMinutes : durationMinutes(drag.activity);
  if (dauer === null || dauer < 0) return null;

  const start = snapStartMinutes(minutesAtOffset(offsetPx, grid));
  return {
    startAt: dayTimeAt(date, start),
    endAt: dayTimeAt(date, start + dauer),
  };
}

/**
 * Der Umriss zu einem Zug ueber dieser Stelle des Rasters -- null, wenn sich
 * daraus keine Zeiten ergeben. Beschriftet ist er mit der Kante, die der
 * Zeiger fuehrt: beim Ziehen der unteren Kante das Ende, sonst der Beginn.
 */
export function timelineDragPreview(
  drag: TimelineDrag,
  date: string,
  offsetPx: number,
  grid: TimelineGrid,
): DragPreview | null {
  const times = timelineDragTimes(drag, date, offsetPx, grid);
  if (!times) return null;

  const layout = computeBlockLayout(times, grid, date);
  return {
    topPx: layout.topPx,
    heightPx: layout.heightPx,
    label: (drag.kind === "resize-end" ? times.endAt : times.startAt).slice(
      11,
      16,
    ),
  };
}
