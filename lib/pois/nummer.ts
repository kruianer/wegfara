import type { Poi } from "./types";

/**
 * Die Nummer eines POI, wie sie im Planer geschrieben steht (req-013,
 * req-074): mit dem Gitter davor -- in der POI-Liste, in der Auswahlliste
 * "Noch unverplant" und am Programmpunkt des Zeitstrahls. Die Kartenmarker
 * tragen die blanke Zahl -- die der POI-Karte wie die der Tageskarte
 * (bug-055) --, weil dort kein Platz fuer ein Zeichen mehr ist; es ist
 * dieselbe Nummer. Eine zweite Zaehlung gibt es nicht -- die Zahl kommt immer
 * aus `poi.number`.
 */
export function formatPoiNummer(number: number): string {
  return `#${number}`;
}

/**
 * Die Nummern der POIs einer Reise nach ihrer Kennung (req-074) -- daraus
 * bekommt ein Programmpunkt des Zeitstrahls die Nummer des POI, aus dem er
 * entstanden ist.
 */
export function poiNummernNachId(pois: Poi[]): Map<string, number> {
  return new Map(pois.map((poi) => [poi.id, poi.number]));
}

/**
 * Die Nummer des POI, aus dem ein Programmpunkt entstanden ist (req-074).
 * Null, wenn er aus keinem stammt -- von Hand angelegt, ohne Bezug zu einem
 * Ort (req-018) -- oder der POI nicht unter den gefuehrten ist. Null heisst:
 * am Programmpunkt steht keine Nummer und kein Platzhalter an ihrer Stelle.
 */
export function activityPoiNummer(
  activity: { poiId?: string },
  nummern: Map<string, number>,
): number | null {
  if (!activity.poiId) return null;
  return nummern.get(activity.poiId) ?? null;
}
