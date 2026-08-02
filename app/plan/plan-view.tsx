"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import { DEFAULT_MAP_VISIBLE_STATUSES } from "@/lib/pois/status-meta";
import type { SearchArea } from "@/lib/pois/search-area";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import { defaultTripId } from "@/lib/trips/select-default";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import {
  ACTIVE_PLAN_AREA,
  SWITCHABLE_PLAN_AREAS,
  type PlanAreaId,
} from "@/lib/plan/areas";
import { useWindowWidth } from "./use-window-width";
import { Header } from "./components/header";
import { PoisView } from "./components/pois-view";
import { PlanungView } from "./components/planung-view";
import { NarrowNotice } from "./components/narrow-notice";
import styles from "./plan-view.module.css";

export function PlanView({
  trips,
  pois = [],
  searchAreas = [],
  activities = [],
  transfers = [],
  optionSelections = {},
  today,
}: {
  trips: Trip[];
  pois?: Poi[];
  searchAreas?: SearchArea[];
  activities?: Activity[];
  transfers?: Transfer[];
  optionSelections?: Record<string, string>;
  today: string;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);

  const [selectedTripId, setSelectedTripId] = useState(() =>
    defaultTripId(trips, todayDate),
  );
  const [activeArea, setActiveArea] = useState<PlanAreaId>(ACTIVE_PLAN_AREA);
  const windowWidth = useWindowWidth();
  // Lebt hier statt in PoisView, da PoisView beim Wechsel des Planer-Bereichs
  // unmountet -- die Auswahl muss die Sitzung ueberdauern (siehe req-013).
  const [visibleMapStatuses, setVisibleMapStatuses] = useState<PoiStatus[]>(
    DEFAULT_MAP_VISIBLE_STATUSES,
  );

  function toggleMapStatus(status: PoiStatus) {
    setVisibleMapStatuses((current) =>
      current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status],
    );
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  if (!selectedTrip) return null;

  const tripPois = pois.filter((poi) => poi.tripId === selectedTrip.id);
  const tripSearchArea =
    searchAreas.find((area) => area.tripId === selectedTrip.id)?.points ?? null;
  const tripActivities = activities.filter(
    (activity) => activity.tripId === selectedTrip.id,
  );
  const tripTransfers = transfers.filter(
    (transfer) => transfer.tripId === selectedTrip.id,
  );

  function selectArea(area: PlanAreaId) {
    if (SWITCHABLE_PLAN_AREAS.includes(area)) setActiveArea(area);
  }

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
            activeArea={activeArea}
            onSelectTrip={setSelectedTripId}
            onSelectArea={selectArea}
          />
          <main className={styles.content}>
            {activeArea === "planung" ? (
              <PlanungView
                trip={selectedTrip}
                pois={tripPois}
                activities={tripActivities}
                transfers={tripTransfers}
                optionSelections={optionSelections}
                today={todayDate}
              />
            ) : (
              <PoisView
                pois={tripPois}
                mainPlace={selectedTrip.mainPlace}
                windowWidth={windowWidth}
                tripId={selectedTrip.id}
                searchArea={tripSearchArea}
                visibleMapStatuses={visibleMapStatuses}
                onToggleMapStatus={toggleMapStatus}
              />
            )}
          </main>
        </>
      )}
    </div>
  );
}
