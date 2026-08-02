"use client";

import { useMemo, useState } from "react";
import type { Poi, PoiPosition, PoiStatus } from "@/lib/pois/types";
import type { MainPlace } from "@/lib/trips/types";
import { savePoiStatus } from "@/lib/pois/save-status";
import { removeSearchArea, saveSearchArea } from "@/lib/pois/save-search-area";
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
  tripId,
  searchArea,
}: {
  pois: Poi[];
  mainPlace: MainPlace;
  windowWidth: number;
  tripId: string;
  searchArea: PoiPosition[] | null;
}) {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, PoiStatus>
  >({});
  const [typeFilter, setTypeFilter] = useState<PoiTypeFilter>("alle");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [highlightedPoiId, setHighlightedPoiId] = useState<string | null>(null);
  const [currentSearchArea, setCurrentSearchArea] = useState(searchArea);
  // Beim Wechsel der Reise das server-seitig geladene Suchgebiet der neuen
  // Reise waehrend des Renderns uebernehmen (siehe react.dev/learn/you-might-not-need-an-effect)
  // -- die Komponente bleibt beim Wechsel gemountet, ihr lokaler Zustand
  // wuerde sonst von der vorigen Reise bleiben (siehe req-012).
  const [syncedTripId, setSyncedTripId] = useState(tripId);
  if (tripId !== syncedTripId) {
    setSyncedTripId(tripId);
    setCurrentSearchArea(searchArea);
  }

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

  function handleSearchAreaChange(points: PoiPosition[] | null) {
    setCurrentSearchArea(points);
    if (points) {
      void saveSearchArea(tripId, points);
    } else {
      void removeSearchArea(tripId);
    }
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
          searchArea={currentSearchArea}
          onSearchAreaChange={handleSearchAreaChange}
        />
      }
    />
  );
}
