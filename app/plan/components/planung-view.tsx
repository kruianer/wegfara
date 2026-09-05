"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import { tripDays } from "@/lib/trips/days";
import { defaultDay } from "@/lib/trips/select-default";
import { activitiesForDay } from "@/lib/activities/day";
import {
  moveActivity,
  planPoi,
  removeActivity,
  resizeActivity,
  resizeActivityStart,
} from "@/lib/activities/save-activity";
import { unplannedPois } from "@/lib/pois/unplanned";
import { POI_ESTIMATED_DURATION_HOURS } from "@/lib/pois/estimated-duration";
import { computeTimelineGrid } from "@/lib/plan/timeline-grid";
import { dropStartAt } from "@/lib/plan/plan-poi";
import type { DropTarget } from "./pointer-drag";
import { UnplannedColumn } from "./unplanned-column";
import { TimelineColumn } from "./timeline-column";
import { DayRouteMap } from "./day-route-map";
import styles from "./planung-view.module.css";

/**
 * Der Bereich "Planung" des Planers (siehe req-011): drei Spalten
 * nebeneinander -- noch unverplante POIs, Zeitstrahl des gewaehlten
 * Reisetages und dessen Karte.
 *
 * Seit req-039 wird hier auch geplant: ein POI laesst sich aus "Noch
 * unverplant" auf den Zeitstrahl ziehen, und ein Programmpunkt laesst sich
 * wieder entfernen. Seit req-040 laesst er sich ausserdem umplanen -- auf eine
 * andere Uhrzeit, auf einen anderen Reisetag oder auf eine andere Dauer, seit
 * req-046 an beiden Kanten. Seit bug-017 geht beides mit der Maus wie mit dem
 * Finger (siehe pointer-drag.ts). Alles
 * ist sofort gespeichert; die Liste der Programmpunkte fuehrt der Aufrufer,
 * damit sie den Bereichswechsel uebersteht. Ohne die jeweiligen Rueckrufe
 * bleibt es bei der reinen Anzeige.
 */
export function PlanungView({
  trip,
  pois,
  activities,
  transfers,
  today,
  optionSelections = {},
  onActivityPlanned,
  onActivityRemoved,
  onActivityRescheduled,
}: {
  trip: Trip;
  pois: Poi[];
  activities: Activity[];
  transfers: Transfer[];
  today: Date;
  optionSelections?: Record<string, string>;
  onActivityPlanned?: (activity: Activity) => void;
  onActivityRemoved?: (activity: Activity) => void;
  /** Ein verschobener oder in seiner Dauer geaenderter Programmpunkt (req-040). */
  onActivityRescheduled?: (activity: Activity) => void;
}) {
  const days = tripDays(trip);
  const [selectedDate, setSelectedDate] = useState(() =>
    defaultDay(trip, today),
  );
  // Welcher POI gerade gezogen wird. Er steht hier und nicht im
  // Datentransfer des Zuges: Spalte und Zeitstrahl sind Schwestern, und der
  // Zustand ist ueberall lesbar -- der Datentransfer erst beim Loslassen.
  // Der ganze POI und nicht nur seine Kennung: der Zeitstrahl zeigt waehrend
  // des Zuges einen Umriss in der Hoehe seiner geschaetzten Dauer (req-046).
  const [draggedPoi, setDraggedPoi] = useState<Poi | null>(null);
  // Wo der Finger den gezogenen POI ueber dem Raster haelt (req-046) -- beim
  // Zug mit der Maus meldet der Zeitstrahl die Stelle selbst.
  const [poiDragOffsetPx, setPoiDragOffsetPx] = useState<number | null>(null);

  const dayActivities = activitiesForDay(activities, trip.id, selectedDate);
  // Der Stundenbereich des Tages steht hier und nicht im Zeitstrahl: beide
  // Spalten rechnen damit, seit ein POI auch mit dem Finger auf dem Raster
  // losgelassen werden kann (bug-017).
  const grid = computeTimelineGrid(dayActivities, selectedDate);
  const plannable = Boolean(onActivityPlanned && onActivityRemoved);
  const reschedulable = Boolean(onActivityRescheduled);

  /**
   * Erst gespeichert, dann gezeigt: was nicht angelegt werden konnte, darf im
   * Zeitstrahl nicht liegen (req-039).
   */
  async function planPoiAt(poiId: string, startAt: string) {
    if (!onActivityPlanned) return;

    const activity = await planPoi(poiId, startAt);
    if (activity) onActivityPlanned(activity);
  }

  /** Mit der Maus auf dem Raster losgelassen -- gezogen wird, was der Zug meldet. */
  async function handleDropPoi(startAt: string) {
    const poi = draggedPoi;
    beendePoiZug();
    if (!poi) return;

    await planPoiAt(poi.id, startAt);
  }

  /**
   * Mit dem Finger ueber dem Raster (req-046): der Zeitstrahl bekommt diese
   * Zeiger-Ereignisse nicht -- sie gehoeren der gezogenen Karte -- und
   * erfaehrt die Stelle deshalb von hier.
   */
  function handlePoiPointerMove(poi: Poi, target: DropTarget | null) {
    setDraggedPoi(poi);
    setPoiDragOffsetPx(target?.kind === "grid" ? target.offsetPx : null);
  }

  /** Der Zug ist vorbei -- der Umriss verschwindet (req-046). */
  function beendePoiZug() {
    setDraggedPoi(null);
    setPoiDragOffsetPx(null);
  }

  /**
   * Mit dem Finger losgelassen (bug-017): auf dem Raster entsteht dort ein
   * Programmpunkt, auf einem Tages-Reiter passiert nichts -- ein POI wird an
   * einer Uhrzeit verplant, nicht an einem Tag.
   */
  async function handlePointerDropPoi(poi: Poi, target: DropTarget) {
    if (target.kind !== "grid") return;

    await planPoiAt(poi.id, dropStartAt(selectedDate, target.offsetPx, grid));
  }

  /**
   * Auf eine andere Uhrzeit oder einen anderen Reisetag gezogen (req-040):
   * die Dauer bleibt gleich. Erst gespeichert, dann gezeigt -- was nicht
   * geschrieben werden konnte, bleibt liegen, wo es lag.
   */
  async function handleMoveActivity(activity: Activity, startAt: string) {
    if (!onActivityRescheduled) return;

    const moved = await moveActivity(activity.id, startAt);
    if (moved) onActivityRescheduled(moved);
  }

  /** An der unteren Kante laenger oder kuerzer gezogen (req-040). */
  async function handleResizeActivity(activity: Activity, endAt: string) {
    if (!onActivityRescheduled) return;

    const resized = await resizeActivity(activity.id, endAt);
    if (resized) onActivityRescheduled(resized);
  }

  /** An der oberen Kante gezogen: der Beginn wandert, das Ende bleibt (req-046). */
  async function handleResizeActivityStart(
    activity: Activity,
    startAt: string,
  ) {
    if (!onActivityRescheduled) return;

    const resized = await resizeActivityStart(activity.id, startAt);
    if (resized) onActivityRescheduled(resized);
  }

  async function handleRemoveActivity(activity: Activity) {
    if (!onActivityRemoved) return;

    const removed = await removeActivity(activity.id);
    if (removed) onActivityRemoved(removed);
  }

  return (
    <div className={styles.planung}>
      <UnplannedColumn
        pois={unplannedPois(pois, activities)}
        onDragStart={plannable ? setDraggedPoi : undefined}
        onDragEnd={plannable ? beendePoiZug : undefined}
        onPointerDragMove={plannable ? handlePoiPointerMove : undefined}
        onPointerDrop={plannable ? handlePointerDropPoi : undefined}
        onPointerDragEnd={plannable ? beendePoiZug : undefined}
      />
      <TimelineColumn
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        activities={dayActivities}
        transfers={transfers}
        grid={grid}
        optionSelections={optionSelections}
        poiPreview={
          draggedPoi && {
            durationMinutes: POI_ESTIMATED_DURATION_HOURS[draggedPoi.type] * 60,
            offsetPx: poiDragOffsetPx,
          }
        }
        onDropPoi={plannable ? handleDropPoi : undefined}
        onRemoveActivity={plannable ? handleRemoveActivity : undefined}
        onMoveActivity={reschedulable ? handleMoveActivity : undefined}
        onResizeActivity={reschedulable ? handleResizeActivity : undefined}
        onResizeActivityStart={
          reschedulable ? handleResizeActivityStart : undefined
        }
      />
      <DayRouteMap
        days={days}
        selectedDate={selectedDate}
        mainPlace={trip.mainPlace}
        activities={dayActivities}
        transfers={transfers}
        optionSelections={optionSelections}
      />
    </div>
  );
}
