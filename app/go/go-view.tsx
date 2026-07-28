"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import { tripDays } from "@/lib/trips/days";
import { defaultTripId, defaultDay } from "@/lib/trips/select-default";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { Header } from "./components/header";
import { TripListSheet } from "./components/trip-list-sheet";
import { DaySelector } from "./components/day-selector";
import { BottomNav } from "./components/bottom-nav";
import styles from "./go-view.module.css";

export function GoView({ trips, today }: { trips: Trip[]; today: string }) {
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

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

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
      <main className={styles.content} />
      <BottomNav />
    </div>
  );
}
