"use client";

import { useMemo, useState } from "react";
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
  hasAiKey = false,
  hasGoogleKey = false,
}: {
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
  /** Ob der Account einen Zugangsschluessel fuer die KI-Suche hat (req-028). */
  hasAiKey?: boolean;
  /** Ob der Account einen Zugangsschluessel fuer Google hat (req-028). */
  hasGoogleKey?: boolean;
}) {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, PoiStatus>
  >({});
  const [typeFilter, setTypeFilter] = useState<PoiTypeFilter>("alle");
  const [highlightedPoiId, setHighlightedPoiId] = useState<string | null>(null);
  const [currentSearchArea, setCurrentSearchArea] = useState(searchArea);
  // Per KI-Suche neu angelegte POIs (siehe req-014) und die aus einem
  // Google-Maps-Link angelegten oder aufgefrischten (req-026): der
  // `pois`-Prop kommt aus dem serverseitig geladenen Anfangszustand und
  // aktualisiert sich nicht von selbst, daher werden Neuzugaenge lokal
  // ergaenzt.
  const [addedPois, setAddedPois] = useState<Poi[]>([]);
  // Von Hand entfernte POIs (req-035) -- wie bei den Neuzugaengen kommt der
  // `pois`-Prop aus dem serverseitig geladenen Anfangszustand.
  const [removedPoiIds, setRemovedPoiIds] = useState<string[]>([]);
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
    setAddedPois([]);
    setRemovedPoiIds([]);
    setPicking(null);
    setPicked(null);
    setDeleting(null);
  }

  const tripPois = useMemo(() => {
    // Ein aufgefrischter (req-026) oder geaenderter POI (req-035) traegt die
    // Kennung eines bereits vorhandenen -- er ersetzt ihn an seiner Stelle,
    // statt ein zweites Mal in der Liste zu erscheinen.
    const nachKennung = new Map<string, Poi>();
    for (const poi of [...pois, ...addedPois]) nachKennung.set(poi.id, poi);
    for (const id of removedPoiIds) nachKennung.delete(id);
    return [...nachKennung.values()].map((poi) =>
      statusOverrides[poi.id]
        ? { ...poi, status: statusOverrides[poi.id] }
        : poi,
    );
  }, [pois, addedPois, removedPoiIds, statusOverrides]);

  // Der Kartenfilter wirkt zusaetzlich zum Typfilter der Liste (siehe
  // req-013): ein POI erscheint auf der Karte nur, wenn er beiden entspricht.
  const mapPois = tripPois.filter(
    (poi) =>
      (typeFilter === "alle" || poi.type === typeFilter) &&
      visibleMapStatuses.includes(poi.status),
  );

  function handleStatusChange(poiId: string, status: PoiStatus) {
    setStatusOverrides((overrides) => ({ ...overrides, [poiId]: status }));
    void savePoiStatus(poiId, status);
  }

  function handlePoisAdded(newPois: Poi[]) {
    setAddedPois((current) => [
      ...current.filter((poi) => !newPois.some((neu) => neu.id === poi.id)),
      ...newPois,
    ]);
  }

  function handlePoiSaved(poi: Poi) {
    handlePoisAdded([poi]);
  }

  function handlePoiDeleted(poi: Poi) {
    setRemovedPoiIds((current) => [...current, poi.id]);
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
    return tripPois.find((poi) => poi.id === key)?.name ?? "Neuer POI";
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
            pois={tripPois}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            highlightedPoiId={highlightedPoiId}
            onStatusChange={handleStatusChange}
            tripId={tripId}
            hasSearchArea={currentSearchArea !== null}
            onPoisAdded={handlePoisAdded}
            hasAiKey={hasAiKey}
            hasGoogleKey={hasGoogleKey}
            picking={picking}
            picked={picked}
            onPickingChange={setPicking}
            onPoiSaved={handlePoiSaved}
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
