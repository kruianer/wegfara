import type { Poi } from "./types";

/**
 * Die Adresse, unter der ein POI bei Google Maps aufgeht (bug-037).
 *
 * Stammt der Ort aus Google, traegt er dessen Kennung (`googlePlaceId`, seit
 * req-026) — dann oeffnet der Link den Ort selbst, mit Namen, Bewertungen und
 * allen Fotos, statt einer Suche nach seinen Koordinaten. Ohne Kennung bleibt
 * es bei den Koordinaten; mehr weiss wegfara ueber einen von Hand angelegten
 * Ort nicht.
 *
 * Uebergeben wird dabei nur ein Link: wegfara ruft Google nicht auf und gibt
 * keine Nutzerdaten dorthin weiter (siehe vision.md).
 */
export function poiMapsUrl(
  poi: Pick<Poi, "position" | "googlePlaceId">,
): string {
  const koordinaten = `${poi.position.lat},${poi.position.lng}`;
  // Google verlangt neben der Kennung immer ein `query`. Es greift erst,
  // wenn Google die Kennung nicht mehr kennt — dann fuehren die Koordinaten
  // wenigstens noch an die richtige Stelle.
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(koordinaten)}`;
  const placeId = poi.googlePlaceId?.trim();
  return placeId ? `${url}&query_place_id=${encodeURIComponent(placeId)}` : url;
}
