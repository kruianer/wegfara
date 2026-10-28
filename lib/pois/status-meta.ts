import type { PoiStatus } from "./types";

/** Reihenfolge, in der die Status in der Auswahlliste erscheinen (siehe req-010). */
export const POI_STATUSES: PoiStatus[] = [
  "gesetzt",
  "wahrscheinlich",
  "weiss_nicht",
  "wenn_zeit",
  "auf_keinen_fall",
];

/** Ob ein Wert aus einer Anfrage ein bekannter Status ist (req-035). */
export function isPoiStatus(value: unknown): value is PoiStatus {
  return typeof value === "string" && POI_STATUSES.includes(value as PoiStatus);
}

/**
 * Die Namen der Status, ueberall in der App (req-100). Sie sind kurz genug
 * fuer die fest breite Statusspalte der POI-Liste (req-097). Die Schluessel
 * in der Datenbank bleiben die alten -- nur die Beschriftung ist neu.
 * "Warteliste" ist nicht die Stimme "Wenn wir Zeit haben" einer
 * Bewertungsrunde (`lib/bewertungen/types.ts`).
 */
export const POI_STATUS_LABEL: Record<PoiStatus, string> = {
  gesetzt: "Fix",
  wahrscheinlich: "Alternative",
  weiss_nicht: "Offen",
  wenn_zeit: "Warteliste",
  auf_keinen_fall: "Nein",
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
