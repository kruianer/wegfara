"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Activity } from "@/lib/activities/types";
import type { WeatherReading } from "@/lib/weather/types";
import { tripDays } from "@/lib/trips/days";
import { defaultTripId, defaultDay } from "@/lib/trips/select-default";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { getWeatherForDay } from "@/lib/weather/get-weather";
import { activitiesForDay } from "@/lib/activities/day";
import { Header } from "./components/header";
import { TripListSheet } from "./components/trip-list-sheet";
import { DaySelector } from "./components/day-selector";
import { Timeline } from "./components/timeline";
import { BottomNav } from "./components/bottom-nav";
import styles from "./go-view.module.css";

export function GoView({
  trips,
  activities = [],
  today,
}: {
  trips: Trip[];
  activities?: Activity[];
  today: string;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);

  const [selectedTripId, setSelectedTripId] = useState(() =>
    defaultTripId(trips, todayDate),
  );
  const [selectedDate, setSelectedDate] = useState(() => {
    const trip = trips.find((t) => t.id === selectedTripId);
    return trip ? defaultDay(trip, todayDate) : null;
  });
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherReading | null>(null);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  useEffect(() => {
    if (!selectedTrip || !selectedDate) return;
    let cancelled = false;
    getWeatherForDay(selectedTrip.mainPlace, selectedDate, today).then(
      (reading) => {
        if (!cancelled) setWeather(reading);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedTrip, selectedDate, today]);

  function selectTrip(tripId: string) {
    setSelectedTripId(tripId);
    setTripSheetOpen(false);
    const trip = trips.find((t) => t.id === tripId);
    if (trip) setSelectedDate(defaultDay(trip, todayDate));
  }

  if (!selectedTrip || !selectedDate) {
    return null;
  }

  return (
    <div className={styles.app}>
      <Header
        trip={selectedTrip}
        weather={weather}
        onOpenTripSheet={() => setTripSheetOpen(true)}
      />
      {tripSheetOpen && (
        <TripListSheet
          trips={trips}
          today={todayDate}
          selectedTripId={selectedTrip.id}
          onSelect={selectTrip}
          onClose={() => setTripSheetOpen(false)}
        />
      )}
      <DaySelector
        days={tripDays(selectedTrip)}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />
      <main className={styles.content}>
        <Timeline
          activities={activitiesForDay(
            activities,
            selectedTrip.id,
            selectedDate,
          )}
        />
      </main>
      <BottomNav />
    </div>
  );
}
