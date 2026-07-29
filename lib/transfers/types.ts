export type TransferMode = "fuss" | "auto" | "bus" | "boot";

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
