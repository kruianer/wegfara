"use client";

import { useState } from "react";
import type { Poi } from "@/lib/pois/types";
import { normalisiereGegend } from "@/lib/pois/gegenden";
import { savePoiGegenden } from "@/lib/pois/save-gegend";

/** Was zu melden ist, wenn die Gegend dieser POIs nicht ankam (bug-021). */
function nichtGespeichert(pois: Poi[]): string {
  if (pois.length === 1) {
    return `Die Gegend von „${pois[0].name}" konnte nicht gespeichert werden.`;
  }
  return `Die Gegend von ${pois.length} POIs konnte nicht gespeichert werden.`;
}

/**
 * Dieselbe Gegend fuer mehrere angekreuzte POIs setzen (req-098) -- „diese
 * sechs sind alle Bilbao". Gebaut wie der gemeinsame Status (req-069, siehe
 * use-poi-status.ts): die Gegend wird sofort angezeigt und dann gespeichert;
 * schlaegt das fehl, kehrt die Anzeige zurueck und sagt es (bug-021).
 */
export function usePoiGegend(
  pois: Poi[],
  onPoisChanged: (pois: Poi[]) => void,
) {
  const [gegendProblem, setGegendProblem] = useState<string | null>(null);

  /** null nimmt den POIs ihre Gegend. */
  async function setzeGegendFuerMehrere(
    poiIds: string[],
    gegend: string | null,
  ) {
    // Die POIs mit ihrer bisherigen Gegend -- an ihnen haengt der Weg
    // zurueck, falls das Speichern fehlschlaegt.
    const betroffene = pois.filter((poi) => poiIds.includes(poi.id));
    if (betroffene.length === 0) return;
    const sauber = normalisiereGegend(gegend) ?? undefined;
    setGegendProblem(null);
    onPoisChanged(betroffene.map((poi) => ({ ...poi, gegend: sauber })));

    const gesetzte = await savePoiGegenden(
      betroffene.map((poi) => poi.id),
      sauber ?? null,
    );
    const misslungene =
      gesetzte === null
        ? betroffene
        : betroffene.filter((poi) => !gesetzte.includes(poi.id));
    if (misslungene.length === 0) return;

    // Zurueck auf den alten Wert -- die Objekte tragen ihn noch.
    onPoisChanged(misslungene);
    setGegendProblem(nichtGespeichert(misslungene));
  }

  return { gegendProblem, setzeGegendFuerMehrere };
}
