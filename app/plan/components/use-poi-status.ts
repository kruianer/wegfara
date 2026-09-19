"use client";

import { useState } from "react";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import { savePoiStatus, savePoiStatuses } from "@/lib/pois/save-status";

/** Was zu melden ist, wenn der Status dieser POIs nicht ankam (bug-021). */
function nichtGespeichert(pois: Poi[]): string {
  if (pois.length === 1) {
    return `Der Status von „${pois[0].name}" konnte nicht gespeichert werden.`;
  }
  return `Der Status von ${pois.length} POIs konnte nicht gespeichert werden.`;
}

/**
 * Den Status eines POI setzen -- aus seiner Zeile in der POI-Liste (req-010)
 * wie aus seiner Zeile im Bereich "Bewertungen" (req-063). Es gibt eine
 * Wahrheit, an zwei Stellen bedienbar. Dieselbe Wahrheit setzt die Liste seit
 * req-069 auch fuer mehrere angekreuzte POIs auf einmal.
 *
 * Der Status wird sofort angezeigt und dann gespeichert. Schlaegt das
 * Speichern fehl, kehrt die Anzeige auf den alten Wert zurueck und sagt es
 * (bug-021) -- ein stiller Fehlschlag, nach dem alles aussieht wie nach einem
 * erfolgreichen Speichern, darf es nicht geben.
 */
export function usePoiStatus(
  pois: Poi[],
  onPoisChanged: (pois: Poi[]) => void,
) {
  /** Was zu melden ist, wenn ein Status nicht gespeichert werden konnte. */
  const [statusProblem, setStatusProblem] = useState<string | null>(null);

  async function setzeStatus(poiId: string, status: PoiStatus) {
    const poi = pois.find((vorhanden) => vorhanden.id === poiId);
    if (!poi) return;
    const vorheriger = poi.status;
    setStatusProblem(null);
    onPoisChanged([{ ...poi, status }]);

    if (await savePoiStatus(poiId, status)) return;

    onPoisChanged([{ ...poi, status: vorheriger }]);
    setStatusProblem(nichtGespeichert([poi]));
  }

  /**
   * Denselben Status fuer mehrere angekreuzte POIs setzen (req-069). Er
   * ersetzt den bisherigen, gleich welcher es war und ob die POIs
   * untereinander verschiedene hatten; POIs, die nicht genannt sind, bleiben
   * unberuehrt.
   */
  async function setzeStatusFuerMehrere(poiIds: string[], status: PoiStatus) {
    // Die POIs mit ihrem bisherigen Status -- an ihnen haengt der Weg
    // zurueck, falls das Speichern fehlschlaegt.
    const betroffene = pois.filter((poi) => poiIds.includes(poi.id));
    if (betroffene.length === 0) return;
    setStatusProblem(null);
    onPoisChanged(betroffene.map((poi) => ({ ...poi, status })));

    const gesetzte = await savePoiStatuses(
      betroffene.map((poi) => poi.id),
      status,
    );
    const misslungene =
      gesetzte === null
        ? betroffene
        : betroffene.filter((poi) => !gesetzte.includes(poi.id));
    if (misslungene.length === 0) return;

    // Zurueck auf den alten Wert -- die Objekte tragen ihn noch.
    onPoisChanged(misslungene);
    setStatusProblem(nichtGespeichert(misslungene));
  }

  return {
    statusProblem,
    setStatusProblem,
    setzeStatus,
    setzeStatusFuerMehrere,
  };
}
