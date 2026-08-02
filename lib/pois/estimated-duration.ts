import type { PoiType } from "./types";

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

/** z.B. "2,5 h" oder "3 h" aus der geschaetzten Dauer eines POI-Typs. */
export function formatEstimatedDuration(type: PoiType): string {
  const hours = POI_ESTIMATED_DURATION_HOURS[type];
  return `${hours.toString().replace(".", ",")} h`;
}
