"use client";

import { useState } from "react";
import type { Poi, PoiPosition, PoiStatus } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { MainPlace } from "@/lib/trips/types";
import type { Bewertungsrunde, Stimme } from "@/lib/bewertungen/types";
import type { BewertendePerson } from "@/lib/bewertungen/stand";
import { savePoiStatus } from "@/lib/pois/save-status";
import { removeSearchArea, saveSearchArea } from "@/lib/pois/save-search-area";
import { activitiesOfPoi } from "@/lib/pois/planned";
import { SplitView } from "./split-view";
import { NEUER_POI, PoiList } from "./poi-list";
import { PoiMap } from "./poi-map";
import { PoiDeleteDialog } from "./poi-delete-dialog";
import { PoiBulkDeleteDialog } from "./poi-bulk-delete-dialog";
import styles from "./pois-view.module.css";

/** Der Bereich "POIs" des Planers (siehe req-010): Liste links, Karte rechts. */
export function PoisView({
  pois,
  activities = [],
  mainPlace,
  windowWidth,
  tripId,
  searchArea,
  onSearchAreaChanged = () => {},
  visibleMapStatuses,
  onToggleMapStatus,
  onPoisChanged,
  onPoiRemoved,
  hasAiKey = false,
  hasGoogleKey = false,
  istReiseleiter = false,
  runden = [],
  stimmen = [],
  personen = [],
  onRundeGestartet = () => {},
  onRundeBeendet = () => {},
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
  /**
   * Das Suchgebiet der geoeffneten Reise. Es liegt wie die POI-Liste in
   * PlanView, da PoisView beim Bereichswechsel unmountet -- ein gezeichnetes
   * Gebiet waere sonst beim Zurueckkommen wieder weg, obwohl es laengst
   * gespeichert ist (bug-030).
   */
  searchArea: PoiPosition[] | null;
  /**
   * Ein gezeichnetes, geaendertes oder entferntes Suchgebiet (bug-030) --
   * gespeichert ist es da bereits; die Liste in PlanView zieht nur nach.
   */
  onSearchAreaChanged?: (tripId: string, points: PoiPosition[] | null) => void;
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
  /** Ein entfernter POI (req-035) — beim Aussortieren mehrerer je einer (req-057). */
  onPoiRemoved: (poi: Poi) => void;
  /** Ob der Account einen Zugangsschluessel fuer die KI-Suche hat (req-028). */
  hasAiKey?: boolean;
  /** Ob der Account einen Zugangsschluessel fuer Google hat (req-028). */
  hasGoogleKey?: boolean;
  /** Ob die angemeldete Person die geoeffnete Reise fuehrt (req-054). */
  istReiseleiter?: boolean;
  /** Die Bewertungsrunden der geoeffneten Reise (req-054). */
  runden?: Bewertungsrunde[];
  /** Die abgegebenen Stimmen dieser Runden. */
  stimmen?: Stimme[];
  /** Die Teilnehmer der Reise, mit ihrem Anzeigenamen. */
  personen?: BewertendePerson[];
  /** Eine gestartete Runde (req-054) -- gespeichert ist sie da bereits. */
  onRundeGestartet?: (runde: Bewertungsrunde) => void;
  /** Eine beendete Runde (req-054) -- gespeichert ist sie da bereits. */
  onRundeBeendet?: (runde: Bewertungsrunde) => void;
}) {
  const [highlightedPoiId, setHighlightedPoiId] = useState<string | null>(null);
  // Welches POI-Formular gerade auf einen Klick in die Karte wartet
  // (req-035), und die zuletzt dort gesetzte Position. Beides liegt hier,
  // weil Liste und Karte Schwestern sind.
  const [picking, setPicking] = useState<string | null>(null);
  const [picked, setPicked] = useState<{
    key: string;
    position: PoiPosition;
  } | null>(null);
  const [deleting, setDeleting] = useState<Poi | null>(null);
  // Die angekreuzten POIs, die auf die Rueckfrage vor dem Aussortieren
  // warten (req-057); leer heisst "keine Rueckfrage offen".
  const [bulkDeleting, setBulkDeleting] = useState<Poi[]>([]);
  /** Was zu melden ist, wenn ein Status nicht gespeichert werden konnte (bug-021). */
  const [statusProblem, setStatusProblem] = useState<string | null>(null);
  // Beim Wechsel der Reise die halbfertigen Vorgaenge der vorigen Reise
  // waehrend des Renderns fallen lassen (siehe
  // react.dev/learn/you-might-not-need-an-effect) -- die Komponente bleibt
  // beim Wechsel gemountet, ihr lokaler Zustand wuerde sonst von der vorigen
  // Reise bleiben. Das Suchgebiet steht nicht mehr darunter: es kommt seit
  // bug-030 mit jedem Rendern aus PlanView und gehoert damit immer zur
  // gezeigten Reise.
  const [syncedTripId, setSyncedTripId] = useState(tripId);
  if (tripId !== syncedTripId) {
    setSyncedTripId(tripId);
    setPicking(null);
    setPicked(null);
    setDeleting(null);
    setBulkDeleting([]);
    setStatusProblem(null);
  }

  // Die Karte hat ihre eigene Statusauswahl (req-013) -- und seit req-060
  // nur noch sie: Filter und Sortierung der Liste wirken allein auf die
  // Liste. Wer einen Typ ausblendet, verliert ihn nicht von der Karte.
  const mapPois = pois.filter((poi) => visibleMapStatuses.includes(poi.status));

  /**
   * Der Status wird sofort angezeigt und dann gespeichert. Schlaegt das
   * Speichern fehl, kehrt die Anzeige auf den alten Wert zurueck und sagt es
   * (bug-021) -- ein stiller Fehlschlag, nach dem alles aussieht wie nach
   * einem erfolgreichen Speichern, darf es nicht geben.
   */
  async function handleStatusChange(poiId: string, status: PoiStatus) {
    const poi = pois.find((vorhanden) => vorhanden.id === poiId);
    if (!poi) return;
    const vorheriger = poi.status;
    setStatusProblem(null);
    onPoisChanged([{ ...poi, status }]);

    if (await savePoiStatus(poiId, status)) return;

    onPoisChanged([{ ...poi, status: vorheriger }]);
    setStatusProblem(
      `Der Status von „${poi.name}" konnte nicht gespeichert werden.`,
    );
  }

  function handlePoiDeleted(poi: Poi) {
    onPoiRemoved(poi);
    setDeleting(null);
  }

  /** Die angekreuzten POIs sind entfernt (req-057) — je einer zieht die Liste nach. */
  function handlePoisDeleted(entfernte: Poi[]) {
    for (const poi of entfernte) onPoiRemoved(poi);
    setBulkDeleting([]);
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
    onSearchAreaChanged(tripId, points);
    if (points) {
      void saveSearchArea(tripId, points);
    } else {
      void removeSearchArea(tripId);
    }
  }

  return (
    <>
      {statusProblem && (
        <p role="alert" className={styles.statusProblem}>
          {statusProblem}
        </p>
      )}
      <SplitView
        windowWidth={windowWidth}
        left={
          <PoiList
            pois={pois}
            highlightedPoiId={highlightedPoiId}
            onStatusChange={handleStatusChange}
            tripId={tripId}
            hasSearchArea={searchArea !== null}
            onPoisAdded={onPoisChanged}
            hasAiKey={hasAiKey}
            hasGoogleKey={hasGoogleKey}
            picking={picking}
            picked={picked}
            onPickingChange={setPicking}
            onPoiSaved={(poi) => onPoisChanged([poi])}
            onPoiDelete={setDeleting}
            onPoisDelete={setBulkDeleting}
            istReiseleiter={istReiseleiter}
            runden={runden}
            stimmen={stimmen}
            personen={personen}
            onRundeGestartet={onRundeGestartet}
            onRundeBeendet={onRundeBeendet}
          />
        }
        right={
          <PoiMap
            pois={mapPois}
            mainPlace={mainPlace}
            visibleStatuses={visibleMapStatuses}
            onToggleStatus={onToggleMapStatus}
            onSelectPoi={setHighlightedPoiId}
            searchArea={searchArea}
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
      {bulkDeleting.length > 0 && (
        <PoiBulkDeleteDialog
          pois={bulkDeleting}
          onDeleted={handlePoisDeleted}
          onCancel={() => setBulkDeleting([])}
        />
      )}
    </>
  );
}
