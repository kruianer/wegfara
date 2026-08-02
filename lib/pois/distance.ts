import type { PoiPosition } from "./types";

const EARTH_RADIUS_KM = 6371;
/** Umwegfaktor gegenueber der Luftlinie (siehe delivery/design/planer README, Abschnitt "1. POIs"). */
const STREET_FACTOR = 1.25;

/** Entfernung zweier Positionen in km, inkl. Umwegfaktor (Strassenschaetzung). */
export function distanceKm(a: PoiPosition, b: PoiPosition): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s)) * STREET_FACTOR;
}
