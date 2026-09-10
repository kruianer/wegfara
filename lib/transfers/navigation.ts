import type { ActivityPosition } from "@/lib/activities/types";
import type { TransferMode } from "./types";

// Google Maps kennt weder Boot noch Flug oder Faehre als eigenes
// Verkehrsmittel (siehe req-006, GUI); fuer sie sowie fuer die Bahn ist der
// OEPNV-Modus die naheliegendste Entsprechung.
const TRAVEL_MODE: Record<TransferMode, string> = {
  fuss: "walking",
  rad: "bicycling",
  auto: "driving",
  bus: "transit",
  boot: "transit",
  flug: "transit",
  bahn: "transit",
  faehre: "transit",
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

/** Ein Ende eines Transfers, wie es in der Navigation steht (req-059). */
export interface Wegende {
  title: string;
  position?: ActivityPosition;
}

/**
 * Google-Maps-Directions-URL mit Start, Ziel und Verkehrsmittel eines
 * Transfers (req-059). Sie steht als Knopf im Transfer-Formular -- bei jedem
 * Verkehrsmittel, gerade bei Bahn und Flug ist sie der Weg zur Verbindung.
 *
 * Uebergeben wird nur der Link; wegfara ruft Google nicht auf und schickt
 * keine Daten dorthin (siehe vision.md). Fehlt einem Ende die Position,
 * steht sein Name im Link -- danach sucht Google Maps selbst.
 */
export function buildTransferRouteUrl(
  from: Wegende,
  to: Wegende,
  mode: TransferMode,
): string {
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${wegendeParameter(from)}` +
    `&destination=${wegendeParameter(to)}` +
    `&travelmode=${TRAVEL_MODE[mode]}`
  );
}

function wegendeParameter({ title, position }: Wegende): string {
  return position
    ? `${position.lat},${position.lng}`
    : encodeURIComponent(title);
}
