import type { Poi, PoiType } from "./types";

/** Das Raster des Zeitstrahls (req-039) -- Dauern sind Vielfache davon. */
export const DURATION_STEP_MINUTES = 15;

/** Geschaetzte Dauer je POI-Typ in Stunden, nach Vorlage (siehe req-011, GUI). */
export const POI_ESTIMATED_DURATION_HOURS: Record<PoiType, number> = {
  sehenswuerdigkeit: 2.5,
  stadt_dorf: 3,
  restaurant: 2,
  strand: 3,
  aktivitaet: 2,
  hotel: 1,
  weltkulturerbe: 2.5,
};

/**
 * Wie lange ein POI dauert, in Minuten: die eingetragene Dauer (req-058),
 * sonst die geschaetzte seines Typs (req-011).
 *
 * Diese Funktion ist die einzige Stelle, die das entscheidet -- wer die
 * Dauer eines POI braucht, fragt hier. Sonst wuerde ein Aufrufer die
 * eingetragene Dauer uebersehen und weiter mit der Schaetzung rechnen.
 */
export function poiDurationMinutes(
  poi: Pick<Poi, "type" | "durationMinutes">,
): number {
  return (
    poi.durationMinutes ??
    POI_ESTIMATED_DURATION_HOURS[poi.type] * MINUTES_PER_HOUR
  );
}

const MINUTES_PER_HOUR = 60;

/** z.B. "2,5 h", "1,5 h" oder "45 Min" aus einer Dauer in Minuten. */
export function formatDuration(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) return `${minutes} Min`;
  const hours = minutes / MINUTES_PER_HOUR;
  return `${hours.toString().replace(".", ",")} h`;
}

/**
 * Was in der Liste zur Dauer eines POI steht: die eingetragene, sonst die
 * geschaetzte seines Typs.
 */
export function formatPoiDuration(
  poi: Pick<Poi, "type" | "durationMinutes">,
): string {
  return formatDuration(poiDurationMinutes(poi));
}

/** z.B. "2,5 h" oder "3 h" aus der geschaetzten Dauer eines POI-Typs. */
export function formatEstimatedDuration(type: PoiType): string {
  const hours = POI_ESTIMATED_DURATION_HOURS[type];
  return `${hours.toString().replace(".", ",")} h`;
}
