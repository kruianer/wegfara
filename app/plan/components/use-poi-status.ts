"use client";

import { useState } from "react";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import { savePoiStatus } from "@/lib/pois/save-status";

/**
 * Den Status eines POI setzen -- aus seiner Zeile in der POI-Liste (req-010)
 * wie aus seiner Zeile im Bereich "Bewertungen" (req-063). Es gibt eine
 * Wahrheit, an zwei Stellen bedienbar.
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
    setStatusProblem(
      `Der Status von „${poi.name}" konnte nicht gespeichert werden.`,
    );
  }

  return { statusProblem, setStatusProblem, setzeStatus };
}
