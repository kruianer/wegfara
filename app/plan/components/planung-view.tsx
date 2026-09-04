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
} from "@/lib/activities/save-activity";
import { unplannedPois } from "@/lib/pois/unplanned";
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
 * andere Uhrzeit, auf einen anderen Reisetag oder auf eine andere Dauer. Alles
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
  const [draggedPoiId, setDraggedPoiId] = useState<string | null>(null);

  const dayActivities = activitiesForDay(activities, trip.id, selectedDate);
  const plannable = Boolean(onActivityPlanned && onActivityRemoved);
  const reschedulable = Boolean(onActivityRescheduled);

  async function handleDropPoi(startAt: string) {
    const poiId = draggedPoiId;
    setDraggedPoiId(null);
    if (!poiId || !onActivityPlanned) return;

    // Erst gespeichert, dann gezeigt: was nicht angelegt werden konnte, darf
    // im Zeitstrahl nicht liegen (req-039).
    const activity = await planPoi(poiId, startAt);
    if (activity) onActivityPlanned(activity);
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

  /** Am unteren Rand laenger oder kuerzer gezogen (req-040). */
  async function handleResizeActivity(activity: Activity, endAt: string) {
    if (!onActivityRescheduled) return;

    const resized = await resizeActivity(activity.id, endAt);
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
        onDragStart={plannable ? (poi) => setDraggedPoiId(poi.id) : undefined}
        onDragEnd={plannable ? () => setDraggedPoiId(null) : undefined}
      />
      <TimelineColumn
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        activities={dayActivities}
        transfers={transfers}
        optionSelections={optionSelections}
        onDropPoi={plannable ? handleDropPoi : undefined}
        onRemoveActivity={plannable ? handleRemoveActivity : undefined}
        onMoveActivity={reschedulable ? handleMoveActivity : undefined}
        onResizeActivity={reschedulable ? handleResizeActivity : undefined}
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
