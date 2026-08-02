import type { PoiStatus } from "./types";

/** Reihenfolge, in der die Status in der Auswahlliste erscheinen (siehe req-010). */
export const POI_STATUSES: PoiStatus[] = [
  "gesetzt",
  "wahrscheinlich",
  "weiss_nicht",
  "wenn_zeit",
  "auf_keinen_fall",
];

export const POI_STATUS_LABEL: Record<PoiStatus, string> = {
  gesetzt: "Gesetzt",
  wahrscheinlich: "Wahrscheinlich",
  weiss_nicht: "Weiß noch nicht",
  wenn_zeit: "Wenn wir Zeit haben",
  auf_keinen_fall: "Auf keinen Fall",
};

/** Status, deren POIs beim Oeffnen der Karte sichtbar sind (siehe req-013). */
export const DEFAULT_MAP_VISIBLE_STATUSES: PoiStatus[] = [
  "gesetzt",
  "wahrscheinlich",
];

/** Statusfarben nach Design Tokens (siehe req-010, GUI). */
export const POI_STATUS_COLOR: Record<PoiStatus, string> = {
  gesetzt: "#8FD6A4",
  wahrscheinlich: "#C0D98F",
  weiss_nicht: "#9BA3C0",
  wenn_zeit: "#E8C27E",
  auf_keinen_fall: "#E896A4",
};
