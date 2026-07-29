import type { ActivityPosition } from "@/lib/activities/types";
import type { TransferMode } from "./types";

const TRAVEL_MODE: Record<TransferMode, string> = {
  fuss: "walking",
  auto: "driving",
  bus: "transit",
  boot: "transit",
};

/**
 * Google-Maps-Directions-URL zum Zielort eines Transfers, mit dessen
 * Verkehrsmittel uebernommen (siehe req-006). wegfara gibt dabei keine
 * Nutzerdaten an den Kartendienst weiter — die URL enthaelt nur die
 * Zielkoordinaten.
 */
export function buildRouteUrl(
  destination: ActivityPosition,
  mode: TransferMode,
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=${TRAVEL_MODE[mode]}`;
}
