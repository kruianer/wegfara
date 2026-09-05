"use client";

import { useState } from "react";
import type { Poi, PoiPosition, PoiStatus } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { MainPlace } from "@/lib/trips/types";
import { savePoiStatus } from "@/lib/pois/save-status";
import { removeSearchArea, saveSearchArea } from "@/lib/pois/save-search-area";
import { activitiesOfPoi } from "@/lib/pois/planned";
import { SplitView } from "./split-view";
import { NEUER_POI, PoiList, type PoiTypeFilter } from "./poi-list";
import { PoiMap } from "./poi-map";
import { PoiDeleteDialog } from "./poi-delete-dialog";

/** Der Bereich "POIs" des Planers (siehe req-010): Liste links, Karte rechts. */
export function PoisView({
  pois,
  activities = [],
  mainPlace,
  windowWidth,
  tripId,
  searchArea,
  visibleMapStatuses,
  onToggleMapStatus,
  onPoisChanged,
  onPoiRemoved,
  hasAiKey = false,
  hasGoogleKey = false,
}: {
  /**
   * Die POIs der geoeffneten Reise. Die Liste liegt in PlanView, da PoisView
   * beim Bereichswechsel unmountet -- ein angelegter POI waere sonst beim
   * Zurueckkommen wieder weg, obwohl er laengst gespeichert ist (bug-020).
   */
  pois: Poi[];
  /** Die Programmpunkte der Reise -- die Rueckfrage vor dem Loeschen nennt
   * den, der aus dem POI entstanden ist (req-035). */
  activities?: Activity[];
  mainPlace: MainPlace;
  windowWidth: number;
  tripId: string;
  searchArea: PoiPosition[] | null;
  /** Status, deren POIs auf der Karte erscheinen (siehe req-013). Lebt in
   * PlanView, da PoisView beim Bereichswechsel unmountet und die Auswahl die
   * Sitzung ueberdauern muss. */
  visibleMapStatuses: PoiStatus[];
  onToggleMapStatus: (status: PoiStatus) => void;
  /**
   * Angelegte, geaenderte oder neu gefundene POIs (bug-020) -- gespeichert
   * sind sie da bereits; die Liste in PlanView zieht nur nach.
   */
  onPoisChanged: (pois: Poi[]) => void;
  /** Ein entfernter POI (req-035). */
  onPoiRemoved: (poi: Poi) => void;
  /** Ob der Account einen Zugangsschluessel fuer die KI-Suche hat (req-028). */
  hasAiKey?: boolean;
  /** Ob der Account einen Zugangsschluessel fuer Google hat (req-028). */
  hasGoogleKey?: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<PoiTypeFilter>("alle");
  const [highlightedPoiId, setHighlightedPoiId] = useState<string | null>(null);
  const [currentSearchArea, setCurrentSearchArea] = useState(searchArea);
  // Welches POI-Formular gerade auf einen Klick in die Karte wartet
  // (req-035), und die zuletzt dort gesetzte Position. Beides liegt hier,
  // weil Liste und Karte Schwestern sind.
  const [picking, setPicking] = useState<string | null>(null);
  const [picked, setPicked] = useState<{
    key: string;
    position: PoiPosition;
  } | null>(null);
  const [deleting, setDeleting] = useState<Poi | null>(null);
  // Beim Wechsel der Reise das server-seitig geladene Suchgebiet der neuen
  // Reise waehrend des Renderns uebernehmen (siehe react.dev/learn/you-might-not-need-an-effect)
  // -- die Komponente bleibt beim Wechsel gemountet, ihr lokaler Zustand
  // wuerde sonst von der vorigen Reise bleiben (siehe req-012).
  const [syncedTripId, setSyncedTripId] = useState(tripId);
  if (tripId !== syncedTripId) {
    setSyncedTripId(tripId);
    setCurrentSearchArea(searchArea);
    setPicking(null);
    setPicked(null);
    setDeleting(null);
  }

  // Der Kartenfilter wirkt zusaetzlich zum Typfilter der Liste (siehe
  // req-013): ein POI erscheint auf der Karte nur, wenn er beiden entspricht.
  const mapPois = pois.filter(
    (poi) =>
      (typeFilter === "alle" || poi.type === typeFilter) &&
      visibleMapStatuses.includes(poi.status),
  );

  function handleStatusChange(poiId: string, status: PoiStatus) {
    const poi = pois.find((vorhanden) => vorhanden.id === poiId);
    if (poi) onPoisChanged([{ ...poi, status }]);
    void savePoiStatus(poiId, status);
  }

  function handlePoiDeleted(poi: Poi) {
    onPoiRemoved(poi);
    setDeleting(null);
  }

  /** Ein Klick auf die Karte gehoert dem Formular, das darauf wartet. */
  function handlePositionPicked(position: PoiPosition) {
    if (!picking) return;
    setPicked({ key: picking, position });
    setPicking(null);
  }

  // Wessen Position der naechste Kartenklick setzt (bug-015). Auf der Karte
  // steht der Name, damit bei mehreren offenen Formularen kein Zweifel
  // bleibt, welchem der Klick gehoert.
  function labelOf(key: string): string {
    if (key === NEUER_POI) return "Neuer POI";
    return pois.find((poi) => poi.id === key)?.name ?? "Neuer POI";
  }

  const pickingLabel = picking === null ? null : labelOf(picking);

  function handleSearchAreaChange(points: PoiPosition[] | null) {
    setCurrentSearchArea(points);
    if (points) {
      void saveSearchArea(tripId, points);
    } else {
      void removeSearchArea(tripId);
    }
  }

  return (
    <>
      <SplitView
        windowWidth={windowWidth}
        left={
          <PoiList
            pois={pois}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            highlightedPoiId={highlightedPoiId}
            onStatusChange={handleStatusChange}
            tripId={tripId}
            hasSearchArea={currentSearchArea !== null}
            onPoisAdded={onPoisChanged}
            hasAiKey={hasAiKey}
            hasGoogleKey={hasGoogleKey}
            picking={picking}
            picked={picked}
            onPickingChange={setPicking}
            onPoiSaved={(poi) => onPoisChanged([poi])}
            onPoiDelete={setDeleting}
          />
        }
        right={
          <PoiMap
            pois={mapPois}
            mainPlace={mainPlace}
            visibleStatuses={visibleMapStatuses}
            onToggleStatus={onToggleMapStatus}
            onSelectPoi={setHighlightedPoiId}
            searchArea={currentSearchArea}
            onSearchAreaChange={handleSearchAreaChange}
            pickingPosition={picking !== null}
            pickingLabel={pickingLabel}
            onPositionPicked={handlePositionPicked}
          />
        }
      />
      {deleting && (
        <PoiDeleteDialog
          poi={deleting}
          activityTitles={activitiesOfPoi(deleting.id, activities).map(
            (activity) => activity.title,
          )}
          onDeleted={handlePoiDeleted}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
