/**
 * Verkehrsmittel eines Transfers. Flug, Bahn und Faehre kamen mit req-018
 * hinzu, damit sich An- und Abreise als gewoehnlicher Transfer abbilden
 * lassen -- eine eigene Art von Element gibt es dafuer nicht.
 */
export type TransferMode =
  | "fuss"
  | "auto"
  | "bus"
  | "boot"
  | "flug"
  | "bahn"
  | "faehre";

/**
 * Verbindet zwei aufeinanderfolgende Programmpunkte desselben Reisetages
 * (siehe req-006). Dauer und Distanz sind hinterlegt, nicht berechnet.
 */
export interface Transfer {
  id: string;
  tripId: string;
  fromActivityId: string;
  toActivityId: string;
  mode: TransferMode;
  title: string;
  durationMin: number;
  distanceKm: number;
}
