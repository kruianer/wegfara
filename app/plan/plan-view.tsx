"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import { defaultTripId } from "@/lib/trips/select-default";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import { useWindowWidth } from "./use-window-width";
import { Header } from "./components/header";
import { PoisView } from "./components/pois-view";
import { NarrowNotice } from "./components/narrow-notice";
import styles from "./plan-view.module.css";

export function PlanView({
  trips,
  pois = [],
  today,
}: {
  trips: Trip[];
  pois?: Poi[];
  today: string;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);

  const [selectedTripId, setSelectedTripId] = useState(() =>
    defaultTripId(trips, todayDate),
  );
  const windowWidth = useWindowWidth();

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  if (!selectedTrip) return null;

  const tripPois = pois.filter((poi) => poi.tripId === selectedTrip.id);

  return (
    <div className={styles.app}>
      {windowWidth < PLANNER_MIN_WIDTH_PX ? (
        <NarrowNotice />
      ) : (
        <>
          <Header
            trips={trips}
            selectedTrip={selectedTrip}
            today={todayDate}
            onSelectTrip={setSelectedTripId}
          />
          <main className={styles.content}>
            <PoisView
              pois={tripPois}
              mainPlace={selectedTrip.mainPlace}
              windowWidth={windowWidth}
            />
          </main>
        </>
      )}
    </div>
  );
}
