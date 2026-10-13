"use client";

import type { Poi, PoiPosition, PoiStatus } from "@/lib/pois/types";
import type { MainPlace } from "@/lib/trips/types";
import { speichereSuchgebiet } from "@/lib/pois/save-search-area";
import { SplitView } from "./split-view";
import { ChatFenster } from "./chat-fenster";
import { PoiMap } from "./poi-map";

/**
 * Der Bereich "Chat" des Planers (req-081): links das Chatfenster, rechts die
 * Karte der Reise mit ihren POIs -- zweigeteilt wie der Bereich "POIs".
 *
 * Die Karte ist in diesem Schritt nur Beiwerk. Sie steht von Anfang an da,
 * weil dort spaeter die Wirkung des Chats zu sehen ist; genommen wird die
 * vorhandene (`poi-map`) und keine zweite gebaut.
 */
export function ChatView({
  tripId,
  pois,
  mainPlace,
  windowWidth,
  searchArea,
  onSearchAreaChanged,
  visibleMapStatuses,
  onToggleMapStatus,
  hasAnthropicKey,
  modell,
  onModellChange,
}: {
  tripId: string;
  /** Die POIs der geoeffneten Reise -- gezeigt wird, was die Karte zeigt. */
  pois: Poi[];
  mainPlace: MainPlace;
  windowWidth: number;
  searchArea: PoiPosition[] | null;
  /**
   * Ein gezeichnetes, geaendertes oder entferntes Suchgebiet (bug-030) --
   * dieselbe Karte wie im Bereich "POIs", also auch dasselbe Verhalten.
   */
  onSearchAreaChanged: (tripId: string, points: PoiPosition[] | null) => void;
  visibleMapStatuses: PoiStatus[];
  onToggleMapStatus: (status: PoiStatus) => void;
  /**
   * Ob der Account einen Anthropic-Zugangsschluessel hinterlegt hat
   * (req-028) -- ohne ihn sagt das Chatfenster das und nennt den Weg zum
   * Hinterlegen.
   */
  hasAnthropicKey: boolean;
  /** Das gewaehlte Modell der Unterhaltung (req-081). */
  modell: string;
  onModellChange: (modell: string) => void;
}) {
  function handleSearchAreaChange(points: PoiPosition[] | null) {
    onSearchAreaChanged(tripId, points);
    speichereSuchgebiet(tripId, points);
  }

  return (
    <SplitView
      windowWidth={windowWidth}
      left={
        <ChatFenster
          tripId={tripId}
          hasAnthropicKey={hasAnthropicKey}
          modell={modell}
          onModellChange={onModellChange}
        />
      }
      right={
        <PoiMap
          tripId={tripId}
          pois={pois.filter((poi) => visibleMapStatuses.includes(poi.status))}
          mainPlace={mainPlace}
          visibleStatuses={visibleMapStatuses}
          onToggleStatus={onToggleMapStatus}
          // Neben der Karte steht hier keine Liste, in der ein getippter POI
          // hervorzuheben waere -- sein Flyout auf der Karte ist die Antwort
          // auf den Tipp.
          onSelectPoi={() => {}}
          searchArea={searchArea}
          onSearchAreaChange={handleSearchAreaChange}
        />
      }
    />
  );
}
