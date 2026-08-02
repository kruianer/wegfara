import type { PoiType } from "./types";
import { ACTIVITY_TYPE_COLOR } from "@/lib/activities/type-meta";

/** Reihenfolge, in der die Typen in Filterleiste und Legende erscheinen (siehe req-010). */
export const POI_TYPES: PoiType[] = [
  "sehenswuerdigkeit",
  "stadt_dorf",
  "restaurant",
  "strand",
  "aktivitaet",
  "hotel",
  "weltkulturerbe",
];

export const POI_TYPE_LABEL: Record<PoiType, string> = {
  sehenswuerdigkeit: "Sehenswürdigkeit",
  stadt_dorf: "Stadt & Dorf",
  restaurant: "Restaurant",
  strand: "Strand",
  aktivitaet: "Aktivität",
  hotel: "Hotel",
  weltkulturerbe: "Weltkulturerbe",
};

/**
 * Feste Typfarben (siehe req-010, GUI). Hotel und Weltkulturerbe teilen
 * sich die Farben des Begleiters aus req-003 -- die uebrigen fuenf sind
 * eigene, im Planer-Design neu vergebene Farben, da diese Typen dort
 * (anders als beim Begleiter) keine eigene Bedeutung als Programmpunkt
 * tragen.
 */
export const POI_TYPE_COLOR: Record<PoiType, string> = {
  sehenswuerdigkeit: "#C97B4A",
  stadt_dorf: "#B98FD6",
  restaurant: "#C23B4D",
  strand: "#4BB8C9",
  aktivitaet: "#5FA854",
  hotel: ACTIVITY_TYPE_COLOR.hotel,
  weltkulturerbe: ACTIVITY_TYPE_COLOR.weltkulturerbe,
};
