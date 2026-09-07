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

/** Alle sieben Verkehrsmittel in der Reihenfolge, in der sie zur Wahl stehen. */
export const TRANSFER_MODES: TransferMode[] = [
  "fuss",
  "auto",
  "bus",
  "boot",
  "flug",
  "bahn",
  "faehre",
];

export function isTransferMode(value: unknown): value is TransferMode {
  return TRANSFER_MODES.includes(value as TransferMode);
}

/**
 * Die Angaben eines neu entstehenden Transfers (req-052) -- ohne Kennung,
 * die vergibt die Ablage. Welche Reise gemeint ist, ergibt sich aus den
 * beiden Programmpunkten und wird nie aus der Anfrage uebernommen (req-024).
 */
export interface TransferValues {
  fromActivityId: string;
  toActivityId: string;
  mode: TransferMode;
  title: string;
  durationMin: number;
  distanceKm: number;
}
