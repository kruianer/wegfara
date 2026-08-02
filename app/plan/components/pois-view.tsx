"use client";

import { useMemo, useState } from "react";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import type { MainPlace } from "@/lib/trips/types";
import { savePoiStatus } from "@/lib/pois/save-status";
import { SplitView } from "./split-view";
import { PoiList, type PoiTypeFilter } from "./poi-list";
import { PoiMap } from "./poi-map";

/** Default aus der Vorlage (siehe delivery/design/planer, Abschnitt "1. POIs"). */
const DEFAULT_RADIUS_KM = 60;

/** Der Bereich "POIs" des Planers (siehe req-010): Liste links, Karte rechts. */
export function PoisView({
  pois,
  mainPlace,
  windowWidth,
}: {
  pois: Poi[];
  mainPlace: MainPlace;
  windowWidth: number;
}) {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, PoiStatus>
  >({});
  const [typeFilter, setTypeFilter] = useState<PoiTypeFilter>("alle");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [highlightedPoiId, setHighlightedPoiId] = useState<string | null>(null);

  const tripPois = useMemo(
    () =>
      pois.map((poi) =>
        statusOverrides[poi.id]
          ? { ...poi, status: statusOverrides[poi.id] }
          : poi,
      ),
    [pois, statusOverrides],
  );

  const visiblePois =
    typeFilter === "alle"
      ? tripPois
      : tripPois.filter((poi) => poi.type === typeFilter);

  function handleStatusChange(poiId: string, status: PoiStatus) {
    setStatusOverrides((overrides) => ({ ...overrides, [poiId]: status }));
    void savePoiStatus(poiId, status);
  }

  return (
    <SplitView
      windowWidth={windowWidth}
      left={
        <PoiList
          pois={tripPois}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          highlightedPoiId={highlightedPoiId}
          onStatusChange={handleStatusChange}
        />
      }
      right={
        <PoiMap
          pois={visiblePois}
          mainPlace={mainPlace}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          onSelectPoi={setHighlightedPoiId}
        />
      }
    />
  );
}
