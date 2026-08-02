"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import { tripDays } from "@/lib/trips/days";
import { defaultDay } from "@/lib/trips/select-default";
import { activitiesForDay } from "@/lib/activities/day";
import { unplannedPois } from "@/lib/pois/unplanned";
import { UnplannedColumn } from "./unplanned-column";
import { TimelineColumn } from "./timeline-column";
import { DayRouteMap } from "./day-route-map";
import styles from "./planung-view.module.css";

/**
 * Der Bereich "Planung" des Planers (siehe req-011): drei Spalten
 * nebeneinander -- noch unverplante POIs, Zeitstrahl des gewaehlten
 * Reisetages und dessen Karte. Reine Anzeige.
 */
export function PlanungView({
  trip,
  pois,
  activities,
  transfers,
  today,
  optionSelections = {},
}: {
  trip: Trip;
  pois: Poi[];
  activities: Activity[];
  transfers: Transfer[];
  today: Date;
  optionSelections?: Record<string, string>;
}) {
  const days = tripDays(trip);
  const [selectedDate, setSelectedDate] = useState(() =>
    defaultDay(trip, today),
  );

  const dayActivities = activitiesForDay(activities, trip.id, selectedDate);

  return (
    <div className={styles.planung}>
      <UnplannedColumn pois={unplannedPois(pois, activities)} />
      <TimelineColumn
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        activities={dayActivities}
        transfers={transfers}
        optionSelections={optionSelections}
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
